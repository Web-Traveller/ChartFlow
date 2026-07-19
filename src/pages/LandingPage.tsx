import { BarChart3, LineChart, CandlestickChart, Zap, Database, Shield, Globe, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation */}
      <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="./logos/chartflow_logo.png" alt="ChartFlow Logo" className="w-8 h-8 rounded object-cover" />
            <span className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              ChartFlow
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <Link to="/" className="text-slate-400 hover:text-white transition-colors">Dashboard</Link>
            <Link to="/settings" className="text-slate-400 hover:text-white transition-colors">Settings</Link>
            <a href="#features" className="text-slate-400 hover:text-white transition-colors">Features</a>
            <a href="#about" className="text-slate-400 hover:text-white transition-colors">About</a>
          </div>
          <Link to="/chart" className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-6 py-2.5 rounded-lg transition-all hover:scale-105">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-24 md:py-32">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-2 mb-8">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 text-sm font-medium">Unlimited Historical Data</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Professional Charts,
            </span>
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Unlimited History
            </span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Access unlimited historical market data with TradingView-style charts. 
            Analyze trends, backtest strategies, and make informed decisions with our powerful charting platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/chart" className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-semibold px-8 py-4 rounded-xl transition-all hover:scale-105 flex items-center justify-center gap-2">
              Start Trading Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <button className="border border-slate-700 hover:border-slate-500 text-white font-semibold px-8 py-4 rounded-xl transition-all hover:bg-slate-800/50 flex items-center justify-center gap-2">
              <LineChart className="w-5 h-5" />
              View Demo
            </button>
          </div>
        </div>

        {/* Chart Preview */}
        <div className="mt-20 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-3xl blur-3xl"></div>
          <div className="relative bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="ml-4 text-slate-500 text-sm">XAU/USD • 1D</span>
            </div>
            <div className="h-64 md:h-96 flex items-end gap-1">
              {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88, 50, 92, 68, 78, 52, 87, 63, 82, 58, 91, 72, 86, 59, 94, 74, 89, 62, 83, 57, 93, 73, 88, 61, 84, 56, 96, 76, 90, 64, 85, 54, 92, 71, 87, 60, 83, 55, 95, 75, 89].map((height, i) => (
                <div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-emerald-500 to-cyan-400 rounded-t-sm opacity-80 hover:opacity-100 transition-opacity"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Everything You Need
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Professional-grade charting tools with unlimited data access
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: Database,
              title: 'Unlimited Historical Data',
              description: 'Access decades of historical market data across all major exchanges and asset classes.',
              color: 'from-blue-500 to-cyan-500'
            },
            {
              icon: CandlestickChart,
              title: 'Advanced Charting',
              description: 'Professional candlestick, line, and bar charts with 100+ technical indicators.',
              color: 'from-emerald-500 to-green-500'
            },
            {
              icon: Zap,
              title: 'Lightning Fast',
              description: 'Real-time data streaming with sub-millisecond latency for instant market updates.',
              color: 'from-yellow-500 to-orange-500'
            },
            {
              icon: Shield,
              title: 'Bank-Grade Security',
              description: 'Enterprise-level encryption and security protocols to protect your data.',
              color: 'from-purple-500 to-pink-500'
            },
            {
              icon: Globe,
              title: 'Global Markets',
              description: 'Access data from 100+ exchanges across 50+ countries worldwide.',
              color: 'from-red-500 to-rose-500'
            },
            {
              icon: BarChart3,
              title: 'Custom Indicators',
              description: 'Build and deploy your own custom indicators with our powerful scripting language.',
              color: 'from-indigo-500 to-blue-500'
            }
          ].map((feature, i) => (
            <div key={i} className="group bg-slate-900/50 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition-all hover:scale-105">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${feature.color} flex items-center justify-center mb-4`}>
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-white">{feature.title}</h3>
              <p className="text-slate-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-3xl p-12">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            {[
              { value: '100+', label: 'Exchanges' },
              { value: '50M+', label: 'Data Points' },
              { value: '10K+', label: 'Active Users' },
              { value: '99.9%', label: 'Uptime' }
            ].map((stat, i) => (
              <div key={i}>
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                  {stat.value}
                </div>
                <div className="text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-12 md:p-20">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Ready to Transform Your Trading?
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-10">
            Join thousands of traders who trust ChartFlow for their market analysis. 
            Start with unlimited free access today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/chart" className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-semibold px-8 py-4 rounded-xl transition-all hover:scale-105 flex items-center gap-2">
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2 text-slate-400">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>No credit card required</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="./logos/chartflow_logo.png" alt="ChartFlow Logo" className="w-6 h-6 rounded object-cover" />
              <span className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                ChartFlow
              </span>
            </div>
            <div className="text-slate-500 text-sm">
              © 2024 ChartFlow. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
