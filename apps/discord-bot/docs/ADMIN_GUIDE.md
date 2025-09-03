# Unit Talk Discord Bot - Admin Guide

## 🛠️ **Complete Administrative Guide**

This guide covers all administrative features, commands, and best practices for
managing the Unit Talk Discord Bot.

---

## 📋 **ADMIN TIER OVERVIEW**

### **Admin Permissions:**

- ✅ All Black Label features
- ✅ Complete user management
- ✅ System configuration
- ✅ Analytics and reporting
- ✅ Moderation tools
- ✅ Backup and recovery

### **Staff Permissions:**

- ✅ All VIP+ features
- ✅ Basic user management
- ✅ Moderation tools
- ✅ Support tools
- ✅ Community management

---

## 🎯 **ADMIN COMMANDS**

### `/admin`

**Description**: Main administrative control panel **Usage**:
`/admin [action] [target] [parameters]` **Admin Only**: Comprehensive admin
interface

#### **Available Actions:**

**User Management:**

```
/admin user_manage list
/admin user_manage view <user_id>
/admin user_manage tier <user_id> <tier>
/admin user_manage ban <user_id> <reason>
/admin user_manage unban <user_id>
```

**System Status:**

```
/admin system_status
/admin system_status health
/admin system_status performance
/admin system_status errors
```

**Configuration:**

```
/admin config_edit feature <feature_name> <value>
/admin config_edit limit <limit_name> <value>
/admin config_edit channel <channel_name> <channel_id>
```

**Analytics:**

```
/admin analytics users
/admin analytics performance
/admin analytics revenue
/admin analytics trends
```

**Backup:**

```
/admin backup create
/admin backup list
/admin backup restore <backup_id>
```

### `/roles`

**Description**: Manage user roles and permissions **Usage**:
`/roles [action] [user] [role]` **Admin/Staff Only**: Role management

#### **Available Actions:**

```
/roles assign <user> <role>
/roles remove <user> <role>
/roles list
/roles check <user>
```

---

## 👥 **USER MANAGEMENT**

### **Viewing User Information:**

```
/admin user_manage view <user_id>
```

Shows:

- User profile and tier
- Pick history and performance
- Account status and flags
- Recent activity

### **Managing User Tiers:**

```
/admin user_manage tier <user_id> <tier>
```

Available tiers:

- `member` (Free)
- `trial` (Trial period)
- `vip` (VIP tier)
- `vip_plus` (VIP+ tier)
- `black_label` (Black Label tier)
- `capper` (Capper tier)
- `staff` (Staff tier)
- `admin` (Admin tier)

### **User Moderation:**

```
/admin user_manage ban <user_id> <reason>
/admin user_manage unban <user_id>
/admin user_manage warn <user_id> <reason>
```

### **Bulk Operations:**

```
/admin user_manage bulk_tier <tier> <user_list>
/admin user_manage bulk_export <filter>
/admin user_manage bulk_cleanup <days>
```

---

## 📊 **SYSTEM MONITORING**

### **Health Checks:**

```
/admin system_status health
```

Monitors:

- Bot connectivity
- Database status
- Service health
- Performance metrics

### **Performance Monitoring:**

```
/admin system_status performance
```

Shows:

- Response times
- Error rates
- Resource usage
- User activity

### **Error Tracking:**

```
/admin system_status errors
```

Displays:

- Recent errors
- Error frequency
- Affected users
- Resolution status

---

## ⚙️ **CONFIGURATION MANAGEMENT**

### **Feature Flags:**

```
/admin config_edit feature auto_grading true
/admin config_edit feature dm_notifications false
/admin config_edit feature thread_management true
```

### **Limits and Thresholds:**

```
/admin config_edit limit max_picks_per_day 10
/admin config_edit limit max_units_per_pick 10
/admin config_edit limit thread_auto_archive 1440
```

### **Channel Configuration:**

```
/admin config_edit channel announcements 123456789
/admin config_edit channel vip_picks 987654321
/admin config_edit channel support 555666777
```

---

## 📈 **ANALYTICS & REPORTING**

### **User Analytics:**

```
/admin analytics users
```

Shows:

- User growth trends
- Tier distribution
- Activity patterns
- Retention rates

### **Performance Analytics:**

```
/admin analytics performance
```

Displays:

- Pick success rates
- Community performance
- Capper rankings
- Revenue metrics

### **Revenue Analytics:**

```
/admin analytics revenue
```

Includes:

- Subscription revenue
- Tier conversion rates
- Payment processing
- Revenue trends

### **Trend Analysis:**

```
/admin analytics trends
```

Covers:

- Popular sports
- Successful strategies
- User behavior patterns
- Market trends

---

## 🔧 **SYSTEM MAINTENANCE**

### **Backup Management:**

```
/admin backup create
```

Creates:

- Database backup
- Configuration backup
- User data backup
- System state backup

### **Backup Operations:**

```
/admin backup list
/admin backup restore <backup_id>
/admin backup delete <backup_id>
```

### **System Cleanup:**

```
/admin system_cleanup old_picks <days>
/admin system_cleanup inactive_users <days>
/admin system_cleanup old_logs <days>
```

---

## 🛡️ **SECURITY & MODERATION**

### **Security Monitoring:**

```
/admin security audit
/admin security logs
/admin security alerts
```

### **Content Moderation:**

```
/admin moderate content <channel_id>
/admin moderate user <user_id>
/admin moderate auto <enable/disable>
```

### **Spam Protection:**

```
/admin spam config <settings>
/admin spam whitelist <user_id>
/admin spam blacklist <user_id>
```

---

## 📱 **NOTIFICATION MANAGEMENT**

### **System Notifications:**

```
/admin notify system <message>
/admin notify tier <tier> <message>
/admin notify users <user_list> <message>
```

### **Alert Configuration:**

```
/admin alerts config <type> <settings>
/admin alerts test <type>
/admin alerts status
```

---

## 🎯 **COMMUNITY MANAGEMENT**

### **Event Management:**

```
/admin event create <name> <date> <description>
/admin event list
/admin event edit <event_id> <field> <value>
/admin event delete <event_id>
```

### **Contest Management:**

```
/admin contest create <name> <rules> <prize>
/admin contest leaderboard <contest_id>
/admin contest end <contest_id>
```

### **Poll Management:**

```
/admin poll create <question> <options>
/admin poll results <poll_id>
/admin poll close <poll_id>
```

---

## 📋 **BEST PRACTICES**

### **Daily Tasks:**

1. **Check System Health**: `/admin system_status health`
2. **Review Error Logs**: `/admin system_status errors`
3. **Monitor User Activity**: `/admin analytics users`
4. **Review Moderation Queue**: Check for flagged content

### **Weekly Tasks:**

1. **Performance Review**: `/admin analytics performance`
2. **User Management**: Review tier assignments
3. **Backup Creation**: `/admin backup create`
4. **Configuration Review**: Check feature flags and limits

### **Monthly Tasks:**

1. **Revenue Analysis**: `/admin analytics revenue`
2. **Trend Analysis**: `/admin analytics trends`
3. **System Cleanup**: Remove old data and logs
4. **Security Audit**: `/admin security audit`

---

## 🚨 **EMERGENCY PROCEDURES**

### **Bot Down:**

1. Check system status: `/admin system_status`
2. Review error logs: `/admin system_status errors`
3. Restart services if needed
4. Notify users: `/admin notify system "Bot maintenance in progress"`

### **Database Issues:**

1. Check database connectivity
2. Review backup status: `/admin backup list`
3. Restore from backup if needed: `/admin backup restore <backup_id>`
4. Contact database administrator

### **Security Breach:**

1. Lock down affected accounts
2. Review security logs: `/admin security logs`
3. Reset compromised credentials
4. Notify affected users
5. Implement additional security measures

---

## 📞 **SUPPORT & ESCALATION**

### **Internal Support:**

- **Technical Issues**: Contact development team
- **User Issues**: Use `/admin user_manage view <user_id>`
- **System Issues**: Check `/admin system_status`

### **External Support:**

- **Discord API Issues**: Check Discord status page
- **Database Issues**: Contact Supabase support
- **Payment Issues**: Contact payment processor

### **Escalation Path:**

1. **Level 1**: Staff/admin team
2. **Level 2**: Senior administrators
3. **Level 3**: Development team
4. **Level 4**: External support

---

## 📚 **RESOURCES**

### **Documentation:**

- **User Guide**: `/help`
- **Command Reference**: See USER_COMMAND_REFERENCE.md
- **Technical Docs**: See README.md
- **API Docs**: See API_DOCUMENTATION.md

### **Tools:**

- **Discord Developer Portal**: Manage bot settings
- **Supabase Dashboard**: Database management
- **Analytics Dashboard**: Performance monitoring
- **Log Management**: Error tracking and debugging

---

## 🎯 **ADMIN CHECKLIST**

### **Daily Checklist:**

- [ ] Check system health
- [ ] Review error logs
- [ ] Monitor user activity
- [ ] Review moderation queue

### **Weekly Checklist:**

- [ ] Performance review
- [ ] User management review
- [ ] Create backup
- [ ] Configuration review

### **Monthly Checklist:**

- [ ] Revenue analysis
- [ ] Trend analysis
- [ ] System cleanup
- [ ] Security audit

---

_Last Updated: July 2025_ _Bot Version: 3.0_
