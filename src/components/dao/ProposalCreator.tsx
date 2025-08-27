import { useState } from 'react'
import { handleError } from '@/utils/standardErrorHandler'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Plus,
  Loader2,
  FileText,
  Lightbulb,
  Settings,
  DollarSign,
  Users,
  Target,
  Clock,
  AlertCircle
} from 'lucide-react'
import { useAccount } from 'wagmi'
import { useDAOInteractions } from '@/hooks/useDAOInteractions'
import { toast } from 'sonner'

interface ProposalCreatorProps {
  onProposalCreated?: () => void
}

const PROPOSAL_TYPES = [
  {
    id: 'feature',
    title: 'Feature Request',
    description: 'Propose new features for the platform',
    icon: Lightbulb,
    color: 'primary',
    examples: ['Add new quest types', 'Implement advanced trading features', 'Create mobile app']
  },
  {
    id: 'governance',
    title: 'Governance Change',
    description: 'Modify voting rules or governance structure',
    icon: Settings,
    color: 'secondary',
    examples: ['Change voting period', 'Adjust quorum requirements', 'Update proposal thresholds']
  },
  {
    id: 'treasury',
    title: 'Treasury Action',
    description: 'Allocate funds or manage treasury assets',
    icon: DollarSign,
    color: 'warning',
    examples: ['Fund development grants', 'Marketing budget allocation', 'Strategic partnerships']
  },
  {
    id: 'community',
    title: 'Community Initiative',
    description: 'Community events, partnerships, or programs',
    icon: Users,
    color: 'success',
    examples: ['Community hackathon', 'Educational programs', 'Ambassador program']
  },
  {
    id: 'other',
    title: 'Other',
    description: 'General proposals and improvements',
    icon: FileText,
    color: 'muted',
    examples: ['General improvements', 'Documentation updates', 'Bug fixes']
  }
]

export const ProposalCreator = ({ onProposalCreated }: ProposalCreatorProps) => {
  const [selectedType, setSelectedType] = useState<string>('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { isConnected } = useAccount()
  const { createProposal, isPending } = useDAOInteractions()

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    if (!selectedType) {
      toast.error('Please select a proposal type')
      return
    }

    setIsSubmitting(true)
    try {
      await createProposal(title.trim(), description.trim())
      
      // Reset form
      setTitle('')
      setDescription('')
      setSelectedType('')
      
      onProposalCreated?.()
      toast.success('Proposal created successfully!')
    } catch (error) {
      handleError(error, { component: 'ProposalCreator', action: 'Create proposal' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedProposal = PROPOSAL_TYPES.find(p => p.id === selectedType)
  const isDisabled = !title.trim() || !description.trim() || !selectedType || isSubmitting || isPending || !isConnected

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Create New Proposal
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Submit your ideas to improve the Avax Forge Empire community
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection Check */}
        {!isConnected && (
          <div className="p-4 rounded-lg bg-warning/10 border border-warning/20 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-warning" />
            <p className="text-sm text-warning">
              Connect your wallet to create proposals
            </p>
          </div>
        )}

        {/* Proposal Type Selection */}
        <div className="space-y-3">
          <Label>Proposal Type *</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {PROPOSAL_TYPES.map((type) => {
              const Icon = type.icon
              const isSelected = selectedType === type.id
              return (
                <Button
                  key={type.id}
                  variant={isSelected ? 'default' : 'outline'}
                  className={`h-auto p-3 flex flex-col items-start gap-2 text-left ${
                    isSelected ? 'ring-2 ring-primary/20' : ''
                  }`}
                  onClick={() => setSelectedType(type.id)}
                  disabled={isSubmitting || isPending}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Icon className="h-4 w-4" />
                    <span className="font-medium text-sm">{type.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground text-left">
                    {type.description}
                  </p>
                </Button>
              )
            })}
          </div>
        </div>

        {/* Examples for selected type */}
        {selectedProposal && (
          <div className="p-3 rounded-lg bg-muted/50 border">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <selectedProposal.icon className="h-4 w-4" />
              Example {selectedProposal.title} Ideas:
            </h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              {selectedProposal.examples.map((example, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-current rounded-full" />
                  {example}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Title Input */}
        <div className="space-y-2">
          <Label htmlFor="title">Proposal Title *</Label>
          <Input
            id="title"
            placeholder="Enter a clear, concise title for your proposal"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            disabled={isSubmitting || isPending}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Be specific and descriptive</span>
            <span>{title.length}/100</span>
          </div>
        </div>

        {/* Description Input */}
        <div className="space-y-2">
          <Label htmlFor="description">Detailed Description *</Label>
          <Textarea
            id="description"
            placeholder="Provide a detailed explanation of your proposal, including the problem it solves, implementation details, and expected benefits..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            maxLength={2000}
            disabled={isSubmitting || isPending}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Include rationale, implementation steps, and expected outcomes</span>
            <span>{description.length}/2000</span>
          </div>
        </div>

        {/* Submission Guidelines */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Voting Process:
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Voting period: 7 days from proposal creation</li>
            <li>• Minimum quorum: 10% of total voting power</li>
            <li>• Simple majority (&gt;50%) required for approval</li>
            <li>• Implementation begins 24 hours after successful vote</li>
          </ul>
        </div>

        {/* Submit Button */}
        <Button 
          onClick={handleSubmit}
          disabled={isDisabled}
          className="w-full flex items-center gap-2 glow-primary"
          size="lg"
        >
          {isSubmitting || isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {isSubmitting ? 'Creating Proposal...' : isPending ? 'Confirming...' : 'Submit Proposal'}
        </Button>

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground text-center">
          By submitting a proposal, you agree to community guidelines and understand that all proposals are public and immutable once created.
        </p>
      </CardContent>
    </Card>
  )
}