#!/usr/bin/env node

import { env } from '../config/env';
import { AlertData, AlertType } from '../services/DiscordAlertRouter';
// import { DiscordAlertRouter } from '../services/DiscordAlertRouter'; // Not used
// import { logger } from '../shared/logger'; // Not used

/**
 * Preview script to show what alerts will look like
 * Displays the routing and formatting without actually sending to Discord
 */
class AlertPreviewGenerator {
  
  async previewAllAlerts(): Promise<void> {
    console.log('\n🎬 UNIT TALK ALERT SYSTEM PREVIEW');
    console.log('=====================================\n');
    
    // Show channel configuration
    this.showChannelConfiguration();
    
    const samples = this.createSampleAlerts();
    
    for (const [alertType, alertData] of samples) {
      this.previewAlert(alertType, alertData);
      console.log('\n' + '─'.repeat(80) + '\n');
    }
    
    console.log('✅ Alert preview completed!\n');
    console.log('💡 To actually send these alerts to Discord:');
    console.log('   1. Complete Discord bot integration');
    console.log('   2. Run: npm run test:alerts');
    console.log('   3. Check your Discord channels for the alerts\n');
  }
  
  private showChannelConfiguration(): void {
    console.log('📍 DISCORD CHANNEL CONFIGURATION:');
    console.log(`   🚨 Alerts Channel: ${env.alertsChannelId || 'NOT CONFIGURED'}`);
    console.log(`   🔧 System Alerts: ${env.systemAlertsThreadId || 'NOT CONFIGURED'}`);
    console.log('   👤 Capper Threads:');
    
    Object.entries(env.capperThreads).forEach(([capper, threadId]) => {
      if (threadId) {
        console.log(`      • ${capper}: ${threadId}`);
      }
    });
    
    console.log('\n');
  }
  
  private previewAlert(alertType: AlertType, alertData: AlertData): void {
    // Determine routing
    const channelId = this.getChannelForAlertType(alertType, alertData);
    const channelName = this.getChannelName(alertType, alertData);
    
    console.log(`🎯 ALERT TYPE: ${alertType.toUpperCase()}`);
    console.log(`📍 ROUTED TO: ${channelName} (${channelId})`);
    console.log(`👤 CAPPER: ${alertData.capper}`);
    console.log(`🏈 SPORT: ${alertData.sport}`);
    
    // Show formatted content preview
    const embed = this.formatAlertPreview(alertData, alertType);
    console.log('\n📱 DISCORD EMBED PREVIEW:');
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log(`│ ${embed.title.padEnd(55)} │`);
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│ ${embed.description.padEnd(55)} │`);
    
    if (embed.fields && embed.fields.length > 0) {
      console.log('├─────────────────────────────────────────────────────────┤');
      embed.fields.forEach((field: any) => {
        console.log(`│ ${field.name}: ${field.value.substring(0, 45).padEnd(45)} │`);
      });
    }
    
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│ Color: ${this.getColorName(embed.color).padEnd(47)} │`);
    console.log(`│ Timestamp: ${new Date().toLocaleTimeString().padEnd(43)} │`);
    console.log('└─────────────────────────────────────────────────────────┘');
  }
  
  private getChannelForAlertType(alertType: AlertType, alertData: AlertData): string {
    switch (alertType) {
      case 'hedge_opportunity':
      case 'middle_opportunity':
      case 'injury_impact':
      case 'steam_move':
      case 'line_movement':
      case 'stale_line':
        return env.alertsChannelId;
      
      case 'pick_post':
        return (env as any).capperThreads[alertData.capper] || 'THREAD_NOT_FOUND';
      
      default:
        return env.systemAlertsThreadId;
    }
  }
  
  private getChannelName(alertType: AlertType, alertData: AlertData): string {
    switch (alertType) {
      case 'hedge_opportunity':
      case 'middle_opportunity':
      case 'injury_impact':
      case 'steam_move':
      case 'line_movement':
      case 'stale_line':
        return '#red-alerts';
      
      case 'pick_post':
        return `#${alertData.capper.toLowerCase()}-picks`;
      
      default:
        return '#system-alerts';
    }
  }
  
  private formatAlertPreview(alertData: AlertData, alertType: AlertType): any {
    switch (alertType) {
      case 'hedge_opportunity':
        return {
          title: '🔄 HEDGE OPPORTUNITY DETECTED',
          description: `${alertData.capper} - ${alertData.sport}`,
          fields: [
            { name: '🎯 Original Pick', value: `${alertData.selection} ${alertData.odds}` },
            { name: '💰 Hedge Details', value: alertData.hedgeDetails || 'Arbitrage available' },
            { name: '📊 Expected Profit', value: alertData.expectedProfit || 'Profit margin available' }
          ],
          color: 0x00ff00
        };
        
      case 'middle_opportunity':
        return {
          title: '🎯 MIDDLE OPPORTUNITY DETECTED',
          description: `${alertData.capper} - ${alertData.sport}`,
          fields: [
            { name: '🎲 Middle Setup', value: alertData.middleSetup || 'Both sides available' },
            { name: '💵 Potential Win', value: alertData.potentialWin || 'Win-win scenario' }
          ],
          color: 0xffa500
        };
        
      case 'injury_impact':
        return {
          title: '🏥 INJURY IMPACT ALERT',
          description: `${alertData.capper} - ${alertData.sport}`,
          fields: [
            { name: '⚠️ Player Status', value: alertData.injuryDetails || 'Injury update' },
            { name: '📈 Impact Assessment', value: alertData.impact || 'Moderate impact' }
          ],
          color: 0xff0000
        };
        
      case 'steam_move':
        return {
          title: '🚀 STEAM MOVE DETECTED',
          description: `${alertData.capper} - ${alertData.sport}`,
          fields: [
            { name: '📊 Sharp Action', value: alertData.steamDetails || 'Sharp money detected' },
            { name: '⏰ Timing', value: 'Act quickly - lines moving' }
          ],
          color: 0x00bfff
        };
        
      case 'pick_post':
        return {
          title: `📊 ${alertData.pickType?.toUpperCase()} PICK${alertData.isLive ? ' - LIVE' : ''}`,
          description: `${alertData.capper} - ${alertData.sport}`,
          fields: [
            { name: '🎯 Selection', value: `${alertData.selection} ${alertData.odds}` },
            { name: '💰 Details', value: `Units: ${alertData.units} | Grade: ${alertData.systemGrade}` }
          ],
          color: alertData.isLive ? 0xff0000 : 0x0099ff
        };
        
      default:
        return {
          title: '📢 ALERT',
          description: `${alertData.capper} - ${alertData.sport}`,
          fields: [],
          color: 0x808080
        };
    }
  }
  
  private getColorName(color: number): string {
    const colors = {
      0x00ff00: 'Green (Profit/Hedge)',
      0xffa500: 'Orange (Middle)',
      0xff0000: 'Red (Injury/Live)',
      0x00bfff: 'Blue (Steam/Regular)',
      0xffff00: 'Yellow (Line Movement)',
      0x800080: 'Purple (Stale Line)',
      0x0099ff: 'Light Blue (Pick)',
      0x808080: 'Gray (Default)'
    };
    
    return (colors as any)[color] || `Hex: ${color.toString(16)}`;
  }
  
  private createSampleAlerts(): Array<[AlertType, AlertData]> {
    return [
      ['hedge_opportunity', {
        pickId: 'hedge-001',
        capper: 'Griff843',
        sport: 'NBA',
        selection: 'Lakers -3.5',
        odds: '-110',
        hedgeDetails: 'DraftKings: Lakers -3.5 (-110) | FanDuel: Celtics +4 (-105)',
        expectedProfit: '2.3% guaranteed profit with proper sizing'
      }],
      
      ['middle_opportunity', {
        pickId: 'middle-002',
        capper: 'KingRo623',
        sport: 'NFL',
        selection: 'Chiefs -7',
        odds: '-115',
        middleSetup: 'Chiefs -7 (-115) + Dolphins +7.5 (-110)',
        potentialWin: 'Win both if final margin is exactly 7 points'
      }],
      
      ['injury_impact', {
        pickId: 'injury-003',
        capper: 'Noahthegoon',
        sport: 'NBA',
        selection: 'Jayson Tatum Over 26.5 Points',
        odds: '-120',
        injuryDetails: 'Jaylen Brown listed as QUESTIONABLE - knee soreness',
        impact: 'HIGH IMPACT: +15% boost if Brown sits'
      }],
      
      ['steam_move', {
        pickId: 'steam-004',
        capper: 'Jaybird',
        sport: 'MLB',
        selection: 'Yankees -1.5',
        odds: '+105',
        steamDetails: 'Line moved +120 to +105 in 10 min. Pinnacle/Circa following'
      }],
      
      ['pick_post', {
        pickId: 'pick-005',
        capper: 'Griff843',
        sport: 'NBA',
        selection: 'Lakers ML + Over 220.5',
        odds: '+245',
        units: 2,
        systemGrade: 'A-tier',
        pickType: 'parlay',
        isLive: false
      }],
      
      ['pick_post', {
        pickId: 'live-006',
        capper: 'Sauced',
        sport: 'NFL',
        selection: 'Chiefs 2H Under 21.5',
        odds: '-115',
        units: 4,
        systemGrade: 'S-tier',
        pickType: 'single',
        isLive: true
      }]
    ];
  }
}

// Run the preview if this script is executed directly
if (require.main === module) {
  const previewer = new AlertPreviewGenerator();
  
  previewer.previewAllAlerts()
    .catch((error) => {
      console.error('💥 Preview generation failed:', error);
      process.exit(1);
    });
}

export { AlertPreviewGenerator };