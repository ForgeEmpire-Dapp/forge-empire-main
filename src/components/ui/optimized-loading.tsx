import { memo } from 'react'
import { Skeleton } from './skeleton'
import { Card, CardContent, CardHeader } from './card'

// Optimized loading components with minimal re-renders

export const PostSkeleton = memo(() => (
  <Card className="bg-gradient-card border-border/50">
    <CardHeader className="pb-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </CardHeader>
    <CardContent className="pt-0 space-y-3">
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="flex items-center gap-4 pt-3">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
      </div>
    </CardContent>
  </Card>
))

PostSkeleton.displayName = 'PostSkeleton'

export const ProfileSkeleton = memo(() => (
  <Card className="bg-gradient-card border-border/50">
    <CardContent className="p-6">
      <div className="flex items-start gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-3 flex-1">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
))

ProfileSkeleton.displayName = 'ProfileSkeleton'

export const FeedSkeleton = memo(({ count = 3 }: { count?: number }) => (
  <div className="space-y-4">
    {Array.from({ length: count }, (_, i) => (
      <PostSkeleton key={i} />
    ))}
  </div>
))

FeedSkeleton.displayName = 'FeedSkeleton'

export const StatsSkeleton = memo(() => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {Array.from({ length: 4 }, (_, i) => (
      <Card key={i} className="bg-gradient-card border-border/50">
        <CardContent className="p-6 text-center space-y-2">
          <Skeleton className="h-8 w-8 mx-auto" />
          <Skeleton className="h-8 w-12 mx-auto" />
          <Skeleton className="h-4 w-16 mx-auto" />
        </CardContent>
      </Card>
    ))}
  </div>
))

StatsSkeleton.displayName = 'StatsSkeleton'

export const TabsSkeleton = memo(() => (
  <div className="space-y-6">
    <div className="flex space-x-1 bg-card border border-border/50 rounded-lg p-1">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-10 flex-1" />
      ))}
    </div>
    <FeedSkeleton />
  </div>
))

TabsSkeleton.displayName = 'TabsSkeleton'