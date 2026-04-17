import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  Camera,
  Wand2,
  LayoutGrid,
  Heart,
  Star,
  Search,
  Lock,
  Zap,
  PlayCircle,
  ChevronRight,
  Menu,
  X
} from 'lucide-react'

// Mock recipe data for the landing page visual
const mockRecipes = [
  {
    id: 1,
    title: 'Spicy Rigatoni Vodka',
    category: 'Main',
    categoryColor: 'bg-[#F5A623]',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&q=80&w=400',
    height: 'h-64',
  },
  {
    id: 2,
    title: 'Classic Tiramisu',
    category: 'Dessert',
    categoryColor: 'bg-pink-500',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&q=80&w=400',
    height: 'h-48',
  },
  {
    id: 3,
    title: 'Baja Fish Tacos',
    category: 'Main',
    categoryColor: 'bg-[#F5A623]',
    rating: 4,
    image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&q=80&w=400',
    height: 'h-56',
  },
  {
    id: 4,
    title: 'Avocado Toast & Egg',
    category: 'Breakfast',
    categoryColor: 'bg-[#14B8A6]',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&q=80&w=400',
    height: 'h-40',
  },
  {
    id: 5,
    title: 'Matcha Mille Crepe',
    category: 'Dessert',
    categoryColor: 'bg-pink-500',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&q=80&w=400',
    height: 'h-72',
  },
  {
    id: 6,
    title: 'Bruschetta',
    category: 'Starter',
    categoryColor: 'bg-emerald-500',
    rating: 4,
    image: 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?auto=format&fit=crop&q=80&w=400',
    height: 'h-52',
  },
]

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/library')
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white selection:bg-[#F5A623] selection:text-white font-sans overflow-x-hidden">
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <LayoutGrid className="w-6 h-6 text-[#F5A623]" />
            <span className="text-xl font-bold tracking-tight">ReciPin</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/login" className="text-sm font-medium text-gray-300 hover:text-white transition">
              Log in
            </Link>
            <Link 
              href="/signup" 
              className="px-4 py-2 text-sm font-semibold text-black bg-[#F5A623] rounded-full hover:bg-[#F5A623]/90 transition shadow-[0_0_15px_rgba(245,166,35,0.3)]"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 bg-gradient-to-br from-[#0A0A0A] to-[#1A1A1A] overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-[#F5A623]/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-[#14B8A6]/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-16 relative z-10">
          
          {/* Left Text */}
          <div className="flex-1 space-y-8 text-center lg:text-left">
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
              Turn any recipe photo or URL into your <br className="hidden lg:block"/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F5A623] to-amber-400">personal Pinterest.</span>
            </h1>
            <p className="text-xl text-[#EAEAEA]/80 max-w-2xl mx-auto lg:mx-0 font-light leading-relaxed">
              AI-powered. Beautifully formatted. Yours forever. Build a gorgeous, organized library of every meal you love in seconds.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
              <Link 
                href="/signup" 
                className="w-full sm:w-auto px-8 py-4 rounded-full bg-[#F5A623] text-black font-semibold text-lg hover:scale-105 transition-transform duration-300 shadow-[0_0_25px_rgba(245,166,35,0.4)] flex items-center justify-center gap-2"
              >
                Start for Free <ChevronRight className="w-5 h-5" />
              </Link>
              <button className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 font-medium text-lg flex items-center justify-center gap-2 transition">
                <PlayCircle className="w-5 h-5" /> Watch 28s demo
              </button>
            </div>

            <div className="pt-8 flex items-center justify-center lg:justify-start gap-3 text-sm text-gray-400">
              <div className="flex -space-x-2">
                {[1,2,3,4].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full border border-[#0F0F0F] bg-gradient-to-tr from-gray-700 to-gray-500" />
                ))}
              </div>
              <p>Used by 1,247 home cooks • Powered by MiniMax M2.7</p>
            </div>
          </div>

          {/* Right Mockup */}
          <div className="w-full lg:w-[45%] relative perspective-1000">
            <div className="relative rounded-[2rem] border border-white/10 bg-[#141414] shadow-2xl overflow-hidden transform lg:rotate-y-[-10deg] lg:rotate-z-[2deg] transition-transform duration-500 hover:rotate-0">
              {/* App Topbar */}
              <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#0A0A0A]/50">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-[#F5A623]" />
                  <span className="font-semibold text-sm">My Library</span>
                </div>
                <Search className="w-4 h-4 text-gray-500" />
              </div>
              
              {/* Grid Mockup */}
              <div className="p-4 grid grid-cols-2 gap-4 h-[500px] overflow-hidden relative">
                {/* Gradient fade at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#141414] to-transparent z-10" />
                
                <div className="space-y-4">
                  {[mockRecipes[0], mockRecipes[1], mockRecipes[2]].map((recipe) => (
                    <div key={recipe.id} className="relative rounded-xl overflow-hidden group bg-[#222]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={recipe.image} className={`w-full object-cover ${recipe.height} opacity-80 group-hover:opacity-100 transition-opacity`} alt="" />
                      <div className="absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-bold text-white bg-black/50 backdrop-blur-sm flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${recipe.categoryColor}`} /> {recipe.category}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="font-medium text-sm text-white truncate">{recipe.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-4 pt-8">
                  {[mockRecipes[3], mockRecipes[4], mockRecipes[5]].map((recipe) => (
                    <div key={recipe.id} className="relative rounded-xl overflow-hidden group bg-[#222]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={recipe.image} className={`w-full object-cover ${recipe.height} opacity-80 group-hover:opacity-100 transition-opacity`} alt="" />
                      <div className="absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-bold text-white bg-black/50 backdrop-blur-sm flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${recipe.categoryColor}`} /> {recipe.category}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="font-medium text-sm text-white truncate">{recipe.title}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* FAB */}
                <div className="absolute bottom-6 right-6 z-20 w-12 h-12 bg-[#F5A623] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(245,166,35,0.4)]">
                  <span className="text-black text-2xl leading-none font-light">+</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24 bg-[#0F0F0F] relative border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-gray-400 max-w-xl mx-auto">Three simple steps to transform messy screenshots and cluttered bookmarks into a pristine recipe collection.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting line on desktop */}
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-[1px] bg-gradient-to-r from-transparent via-[#F5A623]/30 to-transparent" />

            {/* Step 1 */}
            <div className="relative group bg-[#161616] p-8 rounded-3xl border border-white/5 hover:border-[#F5A623]/30 transition-colors">
              <div className="w-16 h-16 rounded-full bg-[#1A1A1A] border border-white/10 flex items-center justify-center mb-6 mx-auto shadow-inner group-hover:scale-110 transition-transform">
                <Camera className="w-7 h-7 text-[#F5A623]" />
              </div>
              <h3 className="text-xl font-semibold text-center mb-3">1. Upload</h3>
              <p className="text-gray-400 text-center text-sm leading-relaxed">
                Snap a photo of a cookbook page, upload a screenshot, or paste any recipe URL.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative group bg-[#161616] p-8 rounded-3xl border border-white/5 hover:border-[#14B8A6]/30 transition-colors">
              <div className="w-16 h-16 rounded-full bg-[#1A1A1A] border border-white/10 flex items-center justify-center mb-6 mx-auto shadow-inner group-hover:scale-110 transition-transform">
                <Wand2 className="w-7 h-7 text-[#14B8A6]" />
              </div>
              <h3 className="text-xl font-semibold text-center mb-3">2. AI Magic</h3>
              <p className="text-gray-400 text-center text-sm leading-relaxed">
                Title, ingredients, steps, category, and difficulty are extracted automatically in seconds.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative group bg-[#161616] p-8 rounded-3xl border border-white/5 hover:border-pink-500/30 transition-colors">
              <div className="w-16 h-16 rounded-full bg-[#1A1A1A] border border-white/10 flex items-center justify-center mb-6 mx-auto shadow-inner group-hover:scale-110 transition-transform">
                <LayoutGrid className="w-7 h-7 text-pink-500" />
              </div>
              <h3 className="text-xl font-semibold text-center mb-3">3. Beautiful Library</h3>
              <p className="text-gray-400 text-center text-sm leading-relaxed">
                Scroll through your private, highly-organized, Pinterest-style recipe collection.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="py-24 bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
              Everything you need. Nothing you don&apos;t.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "Instant AI Extraction", desc: "No manual typing. Our vision models read even messy handwriting.", icon: Zap, color: "text-[#F5A623]" },
              { title: "Pinterest-Perfect Grid", desc: "A gorgeous masonry layout that puts your food photography first.", icon: LayoutGrid, color: "text-[#14B8A6]" },
              { title: "Search, Filter & Sort", desc: "Find that one pasta recipe instantly by category or difficulty.", icon: Search, color: "text-blue-400" },
              { title: "Favorites & 5-Star Ratings", desc: "Heart the best meals and rate them so you never forget.", icon: Star, color: "text-yellow-400" },
              { title: "Private Libraries", desc: "Your recipes are yours alone. Secured by Supabase Auth.", icon: Lock, color: "text-emerald-400" },
              { title: "Free Forever", desc: "Bring your own API key. Zero cost to host and run.", icon: Heart, color: "text-pink-500" },
            ].map((feature, i) => (
              <div key={i} className="p-6 rounded-2xl bg-[#111] border border-white/5 hover:bg-[#161616] transition-colors group">
                <feature.icon className={`w-6 h-6 mb-4 ${feature.color} opacity-80 group-hover:opacity-100`} />
                <h4 className="text-lg font-medium mb-2">{feature.title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-[#0F0F0F] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { text: "I used to have 50 open tabs and screenshots of recipes I'd never make. Now I actually cook them because they look so good in my ReciPin grid.", author: "Sarah M.", role: "Home Cook" },
              { text: "The AI extraction is pure magic. I take a photo of an old family cookbook page and it instantly formats it into a perfect digital card.", author: "James T.", role: "Food Blogger" },
              { text: "It's exactly what I wanted: Pinterest, but only for my recipes, with zero ads, and no endless scrolling to find the ingredients.", author: "Elena R.", role: "Meal Prep Pro" },
            ].map((quote, i) => (
              <div key={i} className="bg-[#141414] p-8 rounded-3xl border border-white/5">
                <div className="flex text-[#F5A623] mb-4">
                  {[1,2,3,4,5].map(s => <Star key={s} className="w-4 h-4 fill-current" />)}
                </div>
                <p className="text-gray-300 italic mb-6 text-sm leading-relaxed">&quot;{quote.text}&quot;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900" />
                  <div>
                    <p className="font-medium text-sm">{quote.author}</p>
                    <p className="text-xs text-gray-500">{quote.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 relative overflow-hidden">
        {/* Deep gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A] to-black" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#F5A623]/10 rounded-t-full blur-[100px] pointer-events-none" />
        
        <div className="relative max-w-4xl mx-auto px-6 text-center z-10">
          <h2 className="text-5xl lg:text-6xl font-bold mb-8 tracking-tight">
            Ready to build your <br /> recipe Pinterest?
          </h2>
          <p className="text-xl text-gray-400 mb-10 font-light max-w-2xl mx-auto">
            Join hundreds of home cooks who have upgraded from messy bookmarks to a beautiful, AI-powered digital kitchen.
          </p>
          <Link 
            href="/signup" 
            className="inline-flex items-center gap-2 px-10 py-5 rounded-full bg-[#F5A623] text-black font-bold text-xl hover:scale-105 transition-transform shadow-[0_0_40px_rgba(245,166,35,0.4)]"
          >
            Start for Free <ChevronRight className="w-6 h-6" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black py-12 text-sm text-gray-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-white/80">
            <LayoutGrid className="w-5 h-5 text-[#F5A623]" />
            <span className="font-semibold text-base">ReciPin</span>
          </div>
          
          <div className="flex gap-6">
            <Link href="#" className="hover:text-white transition">Features</Link>
            <Link href="#" className="hover:text-white transition">Pricing (Free)</Link>
            <Link href="#" className="hover:text-white transition">Roadmap</Link>
            <Link href="#" className="hover:text-white transition">GitHub</Link>
          </div>

          <div className="text-xs flex items-center gap-1.5">
            Made with <Heart className="w-3 h-3 text-red-500 fill-current" /> and <span className="font-medium text-gray-300">MiniMax M2.7</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
