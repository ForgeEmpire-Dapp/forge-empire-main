import { ReactNode, useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  HelpCircle, 
  X, 
  ExternalLink, 
  BookOpen, 
  Video, 
  MessageCircle,
  Lightbulb,
  ArrowRight,
  Sparkles
} from 'lucide-react'
import { Link } from 'react-router-dom'

interface ContextualHelpProps {
  children: ReactNode
  title: string
  content: string | ReactNode
  category?: 'beginner' | 'intermediate' | 'advanced'
  relatedLinks?: Array<{
    title: string
    href: string
    type: 'internal' | 'external'
  }>
  videoUrl?: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  trigger?: 'hover' | 'click'
  className?: string
  showTips?: boolean
  tips?: string[]
}

const categoryStyles = {
  beginner: {
    badge: 'bg-success/20 text-success border-success',
    icon: '🌱',
    color: 'success'
  },
  intermediate: {
    badge: 'bg-warning/20 text-warning border-warning',
    icon: '⚡',
    color: 'warning'
  },
  advanced: {
    badge: 'bg-destructive/20 text-destructive border-destructive',
    icon: '🚀',
    color: 'destructive'
  }
}

export const ContextualHelp = ({ 
  children, 
  title,
  content,
  category = 'beginner',
  relatedLinks = [],
  videoUrl,
  position = 'top',
  trigger = 'click',
  className = '',
  showTips = false,
  tips = []
}: ContextualHelpProps) => {
  const [isVisible, setIsVisible] = useState(false)
  const [actualPosition, setActualPosition] = useState(position)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  const showTooltip = () => setIsVisible(true)
  const hideTooltip = () => setIsVisible(false)

  const categoryStyle = categoryStyles[category]

  useEffect(() => {
    if (isVisible && tooltipRef.current && triggerRef.current) {
      const tooltip = tooltipRef.current
      const trigger = triggerRef.current
      const triggerRect = trigger.getBoundingClientRect()
      const tooltipRect = tooltip.getBoundingClientRect()
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      }

      let newPosition = position

      if (position === 'top' && triggerRect.top - tooltipRect.height < 0) {
        newPosition = 'bottom'
      } else if (position === 'bottom' && triggerRect.bottom + tooltipRect.height > viewport.height) {
        newPosition = 'top'
      } else if (position === 'left' && triggerRect.left - tooltipRect.width < 0) {
        newPosition = 'right'
      } else if (position === 'right' && triggerRect.right + tooltipRect.width > viewport.width) {
        newPosition = 'left'
      }

      setActualPosition(newPosition)
    }
  }, [isVisible, position])

  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-3',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-3',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-3',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-3'
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        ref={triggerRef}
        onMouseEnter={trigger === 'hover' ? showTooltip : undefined}
        onMouseLeave={trigger === 'hover' ? hideTooltip : undefined}
        onClick={trigger === 'click' ? () => setIsVisible(!isVisible) : undefined}
        className="cursor-help"
      >
        {children}
      </div>

      {isVisible && (
        <>
          {trigger === 'click' && (
            <div 
              className="fixed inset-0 z-40"
              onClick={hideTooltip}
            />
          )}
          
          <div
            ref={tooltipRef}
            className={`
              absolute z-50 ${positionClasses[actualPosition]}
              animate-scale-in
            `}
          >
            <Card className="shadow-2xl border-2 max-w-sm w-80 hover-lift">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-accent" />
                      {title}
                    </CardTitle>
                    <Badge variant="outline" className={categoryStyle.badge}>
                      {categoryStyle.icon} {category}
                    </Badge>
                  </div>
                  {trigger === 'click' && (
                    <Button variant="ghost" size="icon" onClick={hideTooltip} className="h-6 w-6">
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="text-sm text-foreground leading-relaxed">
                  {content}
                </div>

                {/* Tips Section */}
                {showTips && tips.length > 0 && (
                  <div className="bg-accent/10 rounded-lg p-3">
                    <h5 className="font-semibold text-sm mb-2 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-accent" />
                      Quick Tips:
                    </h5>
                    <ul className="text-xs space-y-1">
                      {tips.map((tip) => (
                        <li key={tip} className="flex items-start gap-2">
                          <span className="text-accent">•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Video Link */}
                {videoUrl && (
                  <Button variant="outline" size="sm" asChild className="w-full">
                    <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                      <Video className="h-3 w-3" />
                      Watch Tutorial
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}

                {/* Related Links */}
                {relatedLinks.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-semibold text-sm flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      Learn More:
                    </h5>
                    <div className="space-y-1">
                      {relatedLinks.map((link) => (
                        <Button
                          key={link.title}
                          variant="ghost"
                          size="sm"
                          asChild
                          className="w-full justify-start h-auto p-2 text-xs"
                        >
                          {link.type === 'external' ? (
                            <a 
                              href={link.href} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-2"
                            >
                              <ArrowRight className="h-3 w-3" />
                              {link.title}
                              <ExternalLink className="h-3 w-3 ml-auto" />
                            </a>
                          ) : (
                            <Link to={link.href} className="flex items-center gap-2">
                              <ArrowRight className="h-3 w-3" />
                              {link.title}
                            </Link>
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Support Link */}
                <div className="pt-2 border-t">
                  <Button variant="ghost" size="sm" className="w-full text-xs">
                    <MessageCircle className="h-3 w-3 mr-2" />
                    Need more help? Join Discord
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

interface HelpIconProps {
  title: string
  content: string | ReactNode
  category?: 'beginner' | 'intermediate' | 'advanced'
  className?: string
  relatedLinks?: Array<{
    title: string
    href: string
    type: 'internal' | 'external'
  }>
  tips?: string[]
}

export const ContextualHelpIcon = ({ 
  title, 
  content, 
  category = 'beginner', 
  className,
  relatedLinks = [],
  tips = []
}: HelpIconProps) => {
  return (
    <ContextualHelp 
      title={title}
      content={content} 
      category={category}
      trigger="click" 
      className={className}
      relatedLinks={relatedLinks}
      showTips={tips.length > 0}
      tips={tips}
    >
      <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-accent transition-colors cursor-help" />
    </ContextualHelp>
  )
}