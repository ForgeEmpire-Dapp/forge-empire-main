import { ReactNode } from 'react'
import { Header } from '@/components/layout/Header'
import { Breadcrumb } from '@/components/layout/Breadcrumb'

interface PageLayoutProps {
  children: ReactNode
  title?: string
  description?: string
  showBreadcrumb?: boolean
}

export const PageLayout = ({ 
  children, 
  title, 
  description, 
  showBreadcrumb = true 
}: PageLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 md:py-10">
        {showBreadcrumb && <Breadcrumb />}
        
        {(title || description) && (
          <div className="mb-8 animate-fade-in">
            {title && (
              <h1 className="text-3xl font-bold mb-2 bg-gradient-primary bg-clip-text text-transparent">
                {title}
              </h1>
            )}
            {description && (
              <p className="text-muted-foreground text-lg max-w-2xl">
                {description}
              </p>
            )}
          </div>
        )}
        
        <div className="animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  )
}