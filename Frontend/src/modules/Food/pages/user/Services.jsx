import React from "react"
import { motion } from "framer-motion"
import { Briefcase, Utensils, ShoppingBag, Sparkles, Shield, Clock, PhoneCall, Gift, HeartHandshake } from "lucide-react"

export default function Services() {
  const coreServices = [
    {
      title: "Food Delivery",
      description: "Get your favorite meals delivered fast from top-rated local restaurants.",
      icon: Utensils,
      color: "from-pink-500 to-rose-500",
      badge: "Popular"
    },
    {
      title: "Grocery Shopping",
      description: "Fresh groceries, daily essentials, and household items delivered to your doorstep.",
      icon: ShoppingBag,
      color: "from-amber-500 to-orange-500",
      badge: "Fresh"
    },
    {
      title: "Table Booking & Dining",
      description: "Book premium tables in advance and enjoy exclusive discounts on dining out.",
      icon: Sparkles,
      color: "from-purple-500 to-indigo-500",
      badge: "Elite"
    }
  ]

  const upcomingServices = [
    {
      title: "Home Chef Experience",
      description: "Book certified home chefs to cook customized, fresh meals at your home for special events.",
      icon: HeartHandshake,
      color: "from-teal-500 to-emerald-500"
    },
    {
      title: "Event Catering",
      description: "Tailored bulk catering services for parties, weddings, corporate events, and celebrations.",
      icon: Gift,
      color: "from-blue-500 to-cyan-500"
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-[#0a0a0a] pt-4 pb-24 md:pt-24 md:pb-12 px-4 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="text-center max-w-2xl mx-auto mb-10 md:mb-16">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider mb-4"
        >
          <Briefcase className="h-3 w-3" />
          Our Services
        </motion.div>
        
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight mb-4"
        >
          Convenience, <span className="bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent">Reimagined</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-sm md:text-base text-gray-500 dark:text-gray-400"
        >
          Explore the range of premium services we offer to make your life simpler, healthier, and more delightful every day.
        </motion.p>
      </div>

      {/* Core Services Section */}
      <div className="mb-12">
        <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2 px-1">
          <span className="w-1.5 h-6 bg-orange-500 rounded-full" />
          Core Services
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {coreServices.map((service, index) => {
            const Icon = service.icon
            return (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -8 }}
                className="relative bg-white dark:bg-[#121212] rounded-2xl border border-gray-100 dark:border-gray-900 p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] dark:shadow-none overflow-hidden group"
              >
                {/* Decorative background glow */}
                <div className={`absolute -right-12 -top-12 w-32 h-32 rounded-full bg-gradient-to-br ${service.color} opacity-5 blur-2xl group-hover:scale-150 transition-transform duration-700`} />
                
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-4 rounded-2xl bg-gradient-to-br ${service.color} text-white shadow-lg shadow-orange-500/10`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  {service.badge && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-gradient-to-r ${service.color} text-white`}>
                      {service.badge}
                    </span>
                  )}
                </div>

                <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-orange-500 transition-colors">
                  {service.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  {service.description}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Upcoming Services Section */}
      <div className="mb-12">
        <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2 px-1">
          <span className="w-1.5 h-6 bg-purple-500 rounded-full" />
          Coming Soon
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {upcomingServices.map((service, index) => {
            const Icon = service.icon
            return (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                whileHover={{ y: -4 }}
                className="relative bg-white/60 dark:bg-[#121212]/60 backdrop-blur-sm rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 p-6 md:p-8"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${service.color} text-white opacity-70`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="text-base md:text-lg font-bold text-gray-800 dark:text-gray-200">
                        {service.title}
                      </h3>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Beta
                      </span>
                    </div>
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                      {service.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Trust & Features Row */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100 dark:border-gray-900">
        <div className="flex flex-col items-center text-center p-3">
          <Shield className="h-5 w-5 text-green-500 mb-2" />
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Secure Payments</span>
        </div>
        <div className="flex flex-col items-center text-center p-3">
          <Clock className="h-5 w-5 text-blue-500 mb-2" />
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">24/7 Service</span>
        </div>
        <div className="flex flex-col items-center text-center p-3">
          <PhoneCall className="h-5 w-5 text-purple-500 mb-2" />
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Instant Help</span>
        </div>
      </div>
    </div>
  )
}
