'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCircle, AlertTriangle, XCircle, Clock, Settings, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
}

interface NotificationCenterProps {
  alerts: Alert[];
}

export function NotificationCenter({ alerts }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      case 'info':
        return <CheckCircle className="h-4 w-4 text-blue-400" />;
      default:
        return <Bell className="h-4 w-4 text-gray-400" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-red-400';
      case 'warning':
        return 'text-yellow-400';
      case 'info':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  const unreadCount = alerts.filter(
    alert => new Date(alert.timestamp) > new Date(Date.now() - 300000) // Last 5 minutes
  ).length;

  return (
    // Temporarily simplified notification center for build fix
    <div className="relative">
      <button className="ghost inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3 relative">
        <Bell className="h-5 w-5 text-gray-300" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs bg-red-500">
            {unreadCount}
          </Badge>
        )}
      </button>
      {/* DropdownMenuTrigger temporarily disabled for build fix */}
      {/* <DropdownMenuContent
        align="end"
        className="w-80 bg-black/90 backdrop-blur-sm border-gray-800"
        sideOffset={8}
      >
        <DropdownMenuLabel className="flex items-center justify-between text-white">
          <span>Notifications</span>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <Settings className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <X className="h-3 w-3" />
            </Button>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gray-800" />

        <ScrollArea className="h-64">
          {alerts.length > 0 ? (
            <div className="space-y-2 p-2">
              {alerts.map(alert => (
                <div
                  key={alert.id}
                  className="flex items-start space-x-3 p-3 rounded-lg bg-black/20 border border-gray-800 hover:bg-black/40 transition-colors"
                >
                  <div className="flex-shrink-0 mt-0.5">{getAlertIcon(alert.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${getAlertColor(alert.type)}`}>{alert.message}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Clock className="h-3 w-3 text-gray-500" />
                      <span className="text-xs text-gray-500">
                        {formatTimeAgo(alert.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center">
              <Bell className="h-8 w-8 text-gray-500 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No notifications</p>
            </div>
          )}
        </ScrollArea>

        {alerts.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-gray-800" />
            <div className="p-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                View All Notifications
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent> */}
    {/* </DropdownMenu> */}
    </div>
  );
}
