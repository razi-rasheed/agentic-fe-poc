import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function PlanPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Coming in the next slice.</p>
      </CardContent>
    </Card>
  )
}
