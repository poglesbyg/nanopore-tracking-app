'use client'

import { useState } from 'react'
import { Button } from './button'
import { Badge } from './badge'
import { 
  TestTube, 
  FileText, 
  Menu, 
  X,
  Home,
  Settings
} from 'lucide-react'

interface NavigationProps {
  currentPath?: string
}

export function Navigation({ currentPath = '/' }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  const navItems = [
    {
      label: 'Dashboard',
      href: '/',
      icon: Home,
      description: 'Sample management dashboard'
    },
    {
      label: 'Submissions',
      href: '/submissions',
      icon: FileText,
      description: 'PDF submission tracking',
      badge: 'New'
    },
    {
      label: 'Legacy Samples',
      href: '/nanopore',
      icon: TestTube,
      description: 'Individual sample view'
    }
  ]
  
  const isActive = (href: string) => {
    if (href === '/' && currentPath === '/') return true
    if (href !== '/' && currentPath.startsWith(href)) return true
    return false
  }
  
  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <TestTube className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Nanopore Tracking</h1>
              <p className="text-xs text-gray-500">Sample Management System</p>
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`
                  flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${isActive(item.href)
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }
                `}
                title={item.description}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
                {item.badge && (
                  <Badge className="bg-green-100 text-green-800 text-xs px-1.5 py-0.5">
                    {item.badge}
                  </Badge>
                )}
              </a>
            ))}
          </div>
          
          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden border-t border-gray-200 py-2">
            <div className="space-y-1">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center space-x-3 px-4 py-3 text-sm font-medium transition-colors
                    ${isActive(item.href)
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }
                  `}
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span>{item.label}</span>
                      {item.badge && (
                        <Badge className="bg-green-100 text-green-800 text-xs px-1.5 py-0.5">
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
} 