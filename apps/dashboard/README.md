# Unit Talk Frontend Dashboard

A Fortune 100 SaaS-level dashboard for the Unit Talk sports betting platform,
built with Next.js, TypeScript, and Tailwind CSS.

## 🚀 Features

### Core Dashboard

- **Real-time Performance Metrics** - Live tracking of picks, win rates, and ROI
- **User Analytics** - Tier-based user profiles and feature access
- **System Health Monitoring** - Real-time system status and alerts
- **Interactive Charts** - Beautiful data visualization with Recharts

### Tier-Specific Features

- **Member Tier** - Basic pick submission and community access
- **VIP Tier** - Enhanced analytics and premium content
- **VIP+ Tier** - AI coaching and heat signals
- **Black Label Tier** - Portfolio management and market intelligence
- **Capper Tier** - Professional capper tools and revenue sharing
- **Admin Tier** - Full system access and user management

### Advanced Components

- **Performance Metrics** - Comprehensive betting performance tracking
- **User Analytics** - Detailed user profiles and tier management
- **System Health** - Real-time monitoring and alert system
- **Notification Center** - Smart notification management
- **Quick Actions** - Tier-specific action shortcuts

## 🛠 Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI primitives with custom styling
- **Charts**: Recharts for data visualization
- **Icons**: Lucide React
- **State Management**: React hooks and context

## 📦 Installation

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Run Development Server**

   ```bash
   npm run dev
   ```

3. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

## 🎨 Design System

### Color Palette

- **Primary**: Purple gradient theme (#6366f1 to #8b5cf6)
- **Success**: Green (#10b981)
- **Warning**: Yellow (#f59e0b)
- **Error**: Red (#ef4444)
- **Info**: Blue (#3b82f6)

### Tier Colors

- **Member**: Gray (#6b7280)
- **VIP**: Gold (#f59e0b)
- **VIP+**: Purple (#8b5cf6)
- **Black Label**: Black (#000000)
- **Capper**: Red (#dc2626)
- **Admin**: Green (#059669)

### Typography

- **Headings**: Inter font family
- **Body**: System font stack
- **Code**: JetBrains Mono

## 📱 Responsive Design

The dashboard is fully responsive with:

- **Mobile**: Single column layout with collapsible navigation
- **Tablet**: Two-column layout with sidebar navigation
- **Desktop**: Multi-column layout with full navigation

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

### Tailwind Configuration

Custom Tailwind configuration with:

- Custom color palette
- Responsive breakpoints
- Animation utilities
- Dark mode support

## 📊 Data Integration

### Mock Data

Currently uses mock data for development. Replace with real API calls:

- Dashboard statistics
- User analytics
- Performance metrics
- System health data

### API Endpoints

Planned integration with:

- `/api/dashboard/stats` - Dashboard statistics
- `/api/dashboard/live-metrics` - Real-time metrics
- `/api/dashboard/performance` - Performance data
- `/api/dashboard/user-analytics` - User analytics

## 🚀 Performance

### Optimization Features

- **Code Splitting**: Automatic route-based code splitting
- **Image Optimization**: Next.js Image component
- **Lazy Loading**: Component-level lazy loading
- **Caching**: Strategic caching strategies
- **Bundle Analysis**: Built-in bundle analyzer

### Performance Metrics

- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **First Input Delay**: < 100ms

## 🔒 Security

### Security Features

- **TypeScript**: Type safety throughout
- **Input Validation**: Comprehensive form validation
- **XSS Protection**: Built-in React protection
- **CSRF Protection**: Next.js built-in protection
- **Content Security Policy**: Strict CSP headers

## 🧪 Testing

### Testing Strategy

- **Unit Tests**: Component-level testing
- **Integration Tests**: API integration testing
- **E2E Tests**: Full user journey testing
- **Visual Regression**: UI consistency testing

### Test Commands

```bash
npm run test          # Run unit tests
npm run test:e2e      # Run E2E tests
npm run test:visual   # Run visual regression tests
```

## 📈 Analytics

### Built-in Analytics

- **Performance Monitoring**: Real-time performance tracking
- **User Behavior**: User interaction analytics
- **Error Tracking**: Comprehensive error monitoring
- **Business Metrics**: Key performance indicators

## 🔄 Deployment

### Deployment Options

- **Vercel**: Recommended for Next.js
- **Netlify**: Alternative deployment option
- **AWS**: Enterprise deployment
- **Docker**: Containerized deployment

### Environment Setup

1. Set environment variables
2. Configure build settings
3. Set up monitoring
4. Configure CDN

## 🤝 Contributing

### Development Workflow

1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit pull request

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Comprehensive linting rules
- **Prettier**: Consistent code formatting
- **Husky**: Pre-commit hooks

## 📄 License

This project is proprietary software. All rights reserved.

## 🆘 Support

For support and questions:

- **Documentation**: Check the docs folder
- **Issues**: Create GitHub issues
- **Discord**: Join our Discord server
- **Email**: support@unittalk.com

---

**Built with ❤️ by the Unit Talk Team**
