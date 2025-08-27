import { cn } from "@/lib/utils"
import { ReactNode } from 'react'

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted shimmer", className)}
      {...props}
    />
  )
}

interface SkeletonGroupProps {
  children: ReactNode
  loading: boolean
  fallback?: ReactNode
}

export const SkeletonGroup = ({ children, loading, fallback }: SkeletonGroupProps) => {
  if (loading) {
    return fallback ? <>{fallback}</> : <DefaultSkeleton />
  }
  return <>{children}</>
}

const DefaultSkeleton = () => (
  <div className="space-y-4 animate-fade-in">
    <div className="flex items-center space-x-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  </div>
)

// Pre-built skeleton components for common use cases
export const CardSkeleton = () => (
  <div className="border rounded-lg p-6 space-y-4 animate-fade-in">
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-6 w-6 rounded-full" />
    </div>
    <Skeleton className="h-24 w-full" />
    <div className="flex justify-between">
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-4 w-1/6" />
    </div>
  </div>
)

export const StatsSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {[1, 2, 3, 4].map(i => (
      <div key={i} className="border rounded-lg p-6 space-y-3 animate-fade-in">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    ))}
  </div>
)

export { Skeleton }
