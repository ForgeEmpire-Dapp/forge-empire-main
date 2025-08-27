import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trophy, Star, Gift, Calendar } from "lucide-react"
import { useStreakMilestones } from '@/hooks/useStreaks'

export const StreakMilestones = () => {
  const { availableMilestones } = useStreakMilestones()

  // Mock milestone data since we don't have getMilestoneDetails implemented
  const mockMilestones = [
    {
      id: 1,
      requiredDays: 3,
      title: "First Steps",
      description: "Complete 3 consecutive days of activity",
      xpReward: 100,
      isCompleted: true
    },
    {
      id: 2,
      requiredDays: 7,
      title: "Week Warrior",
      description: "Maintain a 7-day streak",
      xpReward: 250,
      isCompleted: true
    },
    {
      id: 3,
      requiredDays: 14,
      title: "Steady Builder",
      description: "Keep going for 2 weeks straight",
      xpReward: 500,
      isCompleted: false
    },
    {
      id: 4,
      requiredDays: 30,
      title: "Monthly Master",
      description: "Achieve a full month of consistency",
      xpReward: 1000,
      isCompleted: false
    },
    {
      id: 5,
      requiredDays: 90,
      title: "Quarterly Champion",
      description: "Dominate for 3 months",
      xpReward: 2500,
      isCompleted: false
    },
    {
      id: 6,
      requiredDays: 365,
      title: "Annual Legend",
      description: "The ultimate achievement - a full year",
      xpReward: 10000,
      isCompleted: false
    }
  ]

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Streak Milestones</h2>
        <p className="text-muted-foreground">
          Reach these milestones to earn special rewards and recognition
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockMilestones.map((milestone) => (
          <Card 
            key={milestone.id} 
            className={`bg-gradient-card border-border/50 hover-scale animate-fade-in ${
              milestone.isCompleted 
                ? 'border-green-500/50 bg-green-500/5' 
                : 'border-border/50'
            }`}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  milestone.isCompleted 
                    ? 'bg-green-500/20 text-green-500' 
                    : 'bg-gradient-primary/10 text-primary'
                }`}>
                  {milestone.isCompleted ? (
                    <Trophy className="w-5 h-5" />
                  ) : (
                    <Star className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-lg">{milestone.title}</CardTitle>
                  <div className="flex items-center space-x-2 mt-1">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {milestone.requiredDays} days
                    </span>
                  </div>
                </div>
              </div>
              <Badge 
                variant={milestone.isCompleted ? "default" : "outline"}
                className={milestone.isCompleted ? "bg-green-500 hover:bg-green-600" : ""}
              >
                {milestone.isCompleted ? "Completed" : "Locked"}
              </Badge>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {milestone.description}
              </p>
              
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex items-center space-x-2">
                  <Gift className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">
                    {milestone.xpReward.toLocaleString()} XP
                  </span>
                </div>
                
                {milestone.isCompleted && availableMilestones?.includes(milestone.id) ? (
                  <Button size="sm" className="bg-green-500 hover:bg-green-600">
                    Claim
                  </Button>
                ) : milestone.isCompleted ? (
                  <Badge variant="outline">Claimed</Badge>
                ) : (
                  <Button size="sm" variant="outline" disabled>
                    Locked
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}