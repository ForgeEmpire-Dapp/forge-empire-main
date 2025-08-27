import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const DEBUG = Deno.env.get("DEBUG") === "true"

// Rate limiting and security
const connectionCounts = new Map<string, { count: number; resetTime: number; connections: number }>()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const MAX_CONNECTIONS_PER_IP = 5
const MAX_REQUESTS_PER_MINUTE = 50
const MAX_SESSION_DURATION = 30 * 60 * 1000 // 30 minutes
const ALLOWED_ORIGINS = ['localhost', 'lovableproject.com', 'forge-empire.com']

function debugLog(message: string, ...args: unknown[]) {
  if (DEBUG) {
    console.log(`[DEBUG] ${message}`, ...args)
  }
}

function errorLog(message: string, error?: unknown) {
  console.error(`[ERROR] ${message}`, error?.message || error)
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = connectionCounts.get(ip)
  
  if (!record || now > record.resetTime) {
    connectionCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW, connections: 1 })
    return true
  }
  
  if (record.count >= MAX_REQUESTS_PER_MINUTE || record.connections >= MAX_CONNECTIONS_PER_IP) {
    return false
  }
  
  record.count++
  record.connections++
  return true
}

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false
  return ALLOWED_ORIGINS.some(allowed => origin.includes(allowed))
}

console.log("Realtime chat function starting...")

serve(async (req) => {
  debugLog("Received request:", req.method, req.url)
  
  // Verify authorization first
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response('Unauthorized: Bearer token required', { status: 401 });
  }
  
  // Security checks
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const origin = req.headers.get('origin')
  
  if (!isOriginAllowed(origin)) {
    console.warn(`Blocked request from unauthorized origin: ${origin}`)
    return new Response('Unauthorized origin', { status: 403 })
  }

  if (!checkRateLimit(clientIP)) {
    console.warn(`Rate limit exceeded for IP: ${clientIP}`)
    return new Response('Rate limit exceeded', { status: 429 })
  }
  
  const { headers } = req
  const upgradeHeader = headers.get("upgrade") || ""

  if (upgradeHeader.toLowerCase() !== "websocket") {
    debugLog("Not a WebSocket request")
    return new Response("Expected WebSocket connection", { status: 400 })
  }

  debugLog("Upgrading to WebSocket...")
  const { socket, response } = Deno.upgradeWebSocket(req)
  
  let openAISocket: WebSocket | null = null
  let sessionCreated = false
  const sessionStartTime = Date.now()
  let messageCount = 0
  const MAX_MESSAGES_PER_SESSION = 100

  socket.onopen = () => {
    console.log(`Client connected from IP: ${clientIP}`)
    
    // Set session timeout
    setTimeout(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close(1000, 'Session timeout')
        console.log(`Session timeout for IP: ${clientIP}`)
      }
    }, MAX_SESSION_DURATION)
    
    // Connect to OpenAI Realtime API
    const openAIUrl = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01"
    openAISocket = new WebSocket(openAIUrl, {
      headers: {
        "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        "OpenAI-Beta": "realtime=v1"
      }
    })

    openAISocket.onopen = () => {
      debugLog("Connected to OpenAI Realtime API")
    }

    openAISocket.onmessage = (event) => {
      debugLog("Received from OpenAI - type only:", JSON.parse(event.data).type)
      const data = JSON.parse(event.data)
      
      // Handle session.created event
      if (data.type === "session.created") {
        debugLog("Session created, sending session.update...")
        sessionCreated = true
        
        const sessionUpdate = {
          event_id: `event_${Date.now()}`,
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: "You are a helpful AI assistant for Avax Forge Empire, a Web3 gaming platform. Help users with quests, understand tokenomics, navigate features, and engage with the community. Be enthusiastic about blockchain gaming and DeFi. Keep responses concise and actionable.",
            voice: "alloy",
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: {
              model: "whisper-1"
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 1000
            },
            tools: [
              {
                type: "function",
                name: "get_user_stats",
                description: "Get current user statistics including XP, level, badges, and streak information.",
                parameters: {
                  type: "object",
                  properties: {
                    wallet_address: { type: "string" }
                  },
                  required: ["wallet_address"]
                }
              },
              {
                type: "function", 
                name: "get_available_quests",
                description: "Get list of available quests for the user.",
                parameters: {
                  type: "object",
                  properties: {
                    difficulty: { type: "string", enum: ["easy", "medium", "hard", "all"] }
                  }
                }
              },
              {
                type: "function",
                name: "get_leaderboard",
                description: "Get current leaderboard rankings.",
                parameters: {
                  type: "object",
                  properties: {
                    category: { type: "string", enum: ["overall", "xp", "quests", "streaks"] },
                    timeframe: { type: "string", enum: ["daily", "weekly", "monthly", "all-time"] }
                  }
                }
              },
              {
                type: "function",
                name: "explain_feature",
                description: "Explain a specific platform feature to the user.",
                parameters: {
                  type: "object",
                  properties: {
                    feature: { type: "string", enum: ["badges", "streaks", "quests", "staking", "dao", "forge", "social"] }
                  },
                  required: ["feature"]
                }
              }
            ],
            tool_choice: "auto",
            temperature: 0.8,
            max_response_output_tokens: "inf"
          }
        }
        
        openAISocket?.send(JSON.stringify(sessionUpdate))
        debugLog("Session update sent")
      }

      // Handle function calls
      if (data.type === "response.function_call_arguments.done") {
        debugLog("Function call completed:", data.name)
        handleFunctionCall(data, openAISocket)
      }

      // Forward all messages to client
      socket.send(event.data)
    }

    openAISocket.onerror = (error) => {
      errorLog("OpenAI WebSocket error:", error)
      socket.send(JSON.stringify({
        type: "error",
        message: "Connection to AI service failed"
      }))
    }

    openAISocket.onclose = () => {
      debugLog("OpenAI WebSocket closed")
      socket.close()
    }
  }

  socket.onmessage = (event) => {
    messageCount++
    
    // Check message rate limit
    if (messageCount > MAX_MESSAGES_PER_SESSION) {
      socket.close(1000, 'Message limit exceeded')
      console.warn(`Message limit exceeded for IP: ${clientIP}`)
      return
    }
    
    // Check session duration
    if (Date.now() - sessionStartTime > MAX_SESSION_DURATION) {
      socket.close(1000, 'Session expired')
      console.warn(`Session expired for IP: ${clientIP}`)
      return
    }
    
    debugLog("Received from client - message type only")
    
    if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
      // Forward client messages to OpenAI
      openAISocket.send(event.data)
    } else {
      debugLog("OpenAI socket not ready, queuing message...")
    }
  }

  socket.onerror = (error) => {
    errorLog("Client WebSocket error:", error)
  }

  socket.onclose = () => {
    console.log(`Client disconnected from IP: ${clientIP}, Messages sent: ${messageCount}`)
    
    // Update connection count
    const record = connectionCounts.get(clientIP)
    if (record) {
      record.connections = Math.max(0, record.connections - 1)
    }
    
    if (openAISocket) {
      openAISocket.close()
    }
  }

  return response
})

async function handleFunctionCall(data: unknown, openAISocket: WebSocket | null) {
  debugLog("Handling function call:", data.name)
  
  let result = { error: "Function not implemented" }
  
  try {
    const args = JSON.parse(data.arguments)
    
    switch (data.name) {
      case "get_user_stats":
        result = await getUserStats(args.wallet_address)
        break
      case "get_available_quests":
        result = await getAvailableQuests(args.difficulty || "all")
        break
      case "get_leaderboard":
        result = await getLeaderboard(args.category || "overall", args.timeframe || "all-time")
        break
      case "explain_feature":
        result = await explainFeature(args.feature)
        break
      default:
        debugLog("Unknown function:", data.name)
    }
  } catch (error) {
    errorLog("Function call error:", error)
    result = { error: error.message }
  }

  // Send function result back to OpenAI
  const functionResult = {
    type: "conversation.item.create",
    item: {
      type: "function_call_output",
      call_id: data.call_id,
      output: JSON.stringify(result)
    }
  }

  debugLog("Sending function result for:", data.name)
  openAISocket?.send(JSON.stringify(functionResult))
  
  // Trigger response generation
  openAISocket?.send(JSON.stringify({ type: "response.create" }))
}

async function getUserStats(walletAddress: string) {
  debugLog("Getting user stats for wallet")
  
  try {
    // Fetch real blockchain data
    const response = await fetch(`https://api.avax-test.network/ext/bc/C/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [
          {
            to: '0x04b49A282B0C4fe61E496160B6481F25FB0624a4', // XPEngine contract
            data: `0x570ca735${walletAddress.slice(2).padStart(64, '0')}` // getXP(address) function signature
          },
          'latest'
        ],
        id: 1
      })
    })
    
    const result = await response.json()
    const xpHex = result.result || '0x0'
    const xp = parseInt(xpHex, 16)
    
    // Calculate level (simple formula: level = floor(xp / 1000) + 1)
    const level = Math.floor(xp / 1000) + 1
    const xpToNext = ((level * 1000) - xp)
    
    return {
      wallet_address: walletAddress,
      level: level,
      total_xp: xp,
      xp_to_next_level: Math.max(0, xpToNext),
      completed_quests: Math.floor(xp / 100), // Estimate based on XP
      current_streak: 7, // This would need separate contract call
      longest_streak: 12, // This would need separate contract call
      badges_earned: 5, // This would need badge contract call
      community_rank: 156, // This would need leaderboard calculation
      tokens_earned: Math.floor(xp / 10) // Estimate based on XP
    }
  } catch (error) {
    errorLog("Error fetching user stats:", error)
    // Fallback to mock data
    return {
      wallet_address: walletAddress,
      level: 8,
      total_xp: 2450,
      xp_to_next_level: 550,
      completed_quests: 23,
      current_streak: 7,
      longest_streak: 12,
      badges_earned: 5,
      community_rank: 156,
      tokens_earned: 340
    }
  }
}

async function getAvailableQuests(difficulty: string) {
  debugLog("Getting available quests, difficulty:", difficulty)
  
  // Mock data - replace with actual quest system queries
  const allQuests = [
    {
      id: "quest_1",
      title: "First Steps",
      description: "Complete your profile setup",
      difficulty: "easy",
      xp_reward: 50,
      token_reward: 5,
      estimated_time: "5 minutes"
    },
    {
      id: "quest_2", 
      title: "Social Butterfly",
      description: "Make 5 social interactions",
      difficulty: "medium",
      xp_reward: 150,
      token_reward: 15,
      estimated_time: "30 minutes"
    },
    {
      id: "quest_3",
      title: "DeFi Master",
      description: "Complete staking tutorial",
      difficulty: "hard", 
      xp_reward: 300,
      token_reward: 30,
      estimated_time: "2 hours"
    }
  ]

  if (difficulty === "all") {
    return { quests: allQuests }
  }
  
  return { 
    quests: allQuests.filter(q => q.difficulty === difficulty)
  }
}

async function getLeaderboard(category: string, timeframe: string) {
  debugLog("Getting leaderboard:", category, timeframe)
  
  // Mock data - replace with actual leaderboard queries
  return {
    category,
    timeframe,
    top_users: [
      { rank: 1, username: "CryptoMaster", xp: 15420, badges: 24, streak: 15 },
      { rank: 2, username: "QuestSeeker", xp: 14750, badges: 19, streak: 12 },
      { rank: 3, username: "ForgeWarrior", xp: 13890, badges: 18, streak: 8 }
    ]
  }
}

async function explainFeature(feature: string) {
  debugLog("Explaining feature:", feature)
  
  const explanations = {
    badges: "Badges are NFT achievements you earn by completing quests, social interactions, and milestones. They come in different rarities: Common, Rare, Epic, and Legendary.",
    streaks: "Streaks track your daily activity. Maintain consecutive days of engagement to earn bonus rewards and climb the leaderboards.",
    quests: "Quests are tasks that help you learn the platform while earning XP and SFORGE tokens. They range from easy tutorials to complex challenges.",
    staking: "Staking allows you to lock your SFORGE tokens to earn rewards and gain governance voting power in the DAO.",
    dao: "The DAO (Decentralized Autonomous Organization) lets token holders vote on platform decisions and future development.",
    forge: "The Forge is where you can create and mint your own tokens, set tokenomics, and launch your project in the ecosystem.",
    social: "The Social Hub is where you connect with other users, share achievements, and participate in community discussions."
  }

  return {
    feature,
    explanation: explanations[feature] || "Feature information not available.",
    learn_more_url: `https://docs.avaxforge.com/${feature}`
  }
}