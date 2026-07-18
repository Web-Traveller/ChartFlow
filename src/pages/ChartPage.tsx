import ChartErrorBoundary from '../components/ChartErrorBoundary'
import TradingViewChart from '../components/TradingViewChart'

export default function ChartPage() {
  return (
    <ChartErrorBoundary>
      <TradingViewChart />
    </ChartErrorBoundary>
  )
}
