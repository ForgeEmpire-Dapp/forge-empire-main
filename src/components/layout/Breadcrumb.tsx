import { useState } from 'react'
import { ChevronRight, Home } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

interface BreadcrumbItem {
  label: string
  path: string
  isActive?: boolean
}

export const Breadcrumb = () => {
  const location = useLocation()
  
  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean)
    
    if (pathSegments.length === 0) {
      return [{ label: 'Dashboard', path: '/', isActive: true }]
    }

    const breadcrumbs: BreadcrumbItem[] = [
      { label: 'Dashboard', path: '/' }
    ]

    let currentPath = ''
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`
      const isLast = index === pathSegments.length - 1
      
      const label = formatPathSegment(segment)
      breadcrumbs.push({
        label,
        path: currentPath,
        isActive: isLast
      })
    })

    return breadcrumbs
  }

  const formatPathSegment = (segment: string): string => {
    const formatMap: Record<string, string> = {
      'quests': 'Quests',
      'dynamic-quests': 'AI Quests', 
      'social': 'Social',
      'streaks': 'Streaks',
      'profile': 'Profile',
      'forge': 'Token Forge',
      'dao': 'DAO',
      'kudos': 'Kudos',
      'tip-jar': 'Tip Jar',
      'roadmap': 'Roadmap'
    }
    
    return formatMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
      {breadcrumbs.map((breadcrumb, index) => (
        <div key={breadcrumb.path} className="flex items-center space-x-2">
          {index === 0 && <Home className="h-4 w-4" />}
          
          {breadcrumb.isActive ? (
            <span className="font-medium text-foreground">
              {breadcrumb.label}
            </span>
          ) : (
            <Link
              to={breadcrumb.path}
              className="hover:text-foreground transition-colors story-link"
            >
              {breadcrumb.label}
            </Link>
          )}
          
          {index < breadcrumbs.length - 1 && (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
      ))}
    </nav>
  )
}