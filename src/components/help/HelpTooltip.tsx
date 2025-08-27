import { ReactNode, useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HelpCircle, X } from 'lucide-react'

interface TooltipProps {
  children: ReactNode
  content: string | ReactNode
  title?: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  trigger?: 'hover' | 'click'
  className?: string
}

export const HelpTooltip = ({ 
  children, 
  content, 
  title,
  position = 'top',
  trigger = 'hover',
  className = ''
}: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false)
  const [actualPosition, setActualPosition] = useState(position)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  const showTooltip = () => setIsVisible(true)
  const hideTooltip = () => setIsVisible(false)

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

      // Check if tooltip would go outside viewport and adjust
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
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
  }

  const arrowClasses = {
    top: 'top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-background',
    bottom: 'bottom-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-background',
    left: 'left-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-background',
    right: 'right-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-background'
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
          {/* Backdrop for click-triggered tooltips */}
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
            <Card className="shadow-lg border-2 max-w-xs">
              <CardContent className="p-3">
                {title && (
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm">{title}</h4>
                    {trigger === 'click' && (
                      <Button variant="ghost" size="icon" onClick={hideTooltip} className="h-4 w-4">
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  {content}
                </div>
              </CardContent>
            </Card>
            
            {/* Arrow */}
            <div 
              className={`
                absolute w-0 h-0 border-4 ${arrowClasses[actualPosition]}
              `}
            />
          </div>
        </>
      )}
    </div>
  )
}

interface HelpIconProps {
  content: string | ReactNode
  title?: string
  className?: string
}

export const HelpIcon = ({ content, title, className }: HelpIconProps) => {
  return (
    <HelpTooltip content={content} title={title} trigger="click" className={className}>
      <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
    </HelpTooltip>
  )
}