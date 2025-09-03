// @ts-nocheck
'use client';

import React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Trash2, MessageSquare, Mail, Hash } from 'lucide-react';
// import type { AlertPolicy } from '@/lib/alertsClient';

// interface AlertsTableProps {
//   policies: AlertPolicy[];
//   onEdit: (policy: AlertPolicy) => void;
//   onDelete: (id: string) => void;
//   onToggle: (id: string, enabled: boolean) => void;
// }

export function AlertsTable({ policies, onEdit, onDelete, onToggle }) {
  const getChannelIcon = (type) => {
    switch (type) {
      case 'discord':
        return <MessageSquare className="h-3 w-3" />;
      case 'email':
        return <Mail className="h-3 w-3" />;
      case 'slack':
        return <Hash className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const formatChannelsSummary = (channels) => {
    const summary = channels.reduce((acc, channel) => {
      acc[channel.type] = (acc[channel.type] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(summary).map(([type, count]) => (
      <Badge key={type} variant="secondary" className="gap-1">
        {getChannelIcon(type)}
        {type} ({count})
      </Badge>
    ));
  };

  if (policies.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No alert policies configured</p>
        <p className="text-sm mt-2">Create your first alert policy to get started</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Key</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Threshold</TableHead>
          <TableHead>Channels</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {policies.map((policy) => (
          <TableRow key={policy.id}>
            <TableCell className="font-medium">
              <code className="px-2 py-1 bg-muted rounded text-sm">
                {policy.key}
              </code>
            </TableCell>
            <TableCell>
              <Switch
                checked={policy.enabled}
                onCheckedChange={(checked) => onToggle(policy.id, checked)}
                aria-label={`Toggle ${policy.key}`}
              />
            </TableCell>
            <TableCell>
              {policy.threshold !== undefined ? (
                <Badge variant="outline">{policy.threshold}</Badge>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                {formatChannelsSummary(policy.channels)}
              </div>
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(policy)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onDelete(policy.id)}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}