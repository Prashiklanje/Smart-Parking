# Deployment Guide - Smart Parking System

## 🌐 Production Deployment

This guide covers deploying the Smart Parking System to production environments.

## Prerequisites

- Node.js 14+ installed on server
- Domain name (optional but recommended)
- SSL certificate (for HTTPS)
- MongoDB Atlas account (for database) or local MongoDB
- PM2 for process management (recommended)

## 🗄️ Database Setup (MongoDB)

### Option 1: MongoDB Atlas (Recommended)

1. Create account at https://www.mongodb.com/cloud/atlas
2. Create a new cluster (free tier available)
3. Create database user and password
4. Whitelist your server IP address
5. Get connection string

### Option 2: Local MongoDB

1. Install MongoDB on your server
2. Start MongoDB service
3. Create database: `smart-parking`
4. Note connection string: `mongodb://localhost:27017/smart-parking`

### Database Migration

Update `backend/server.js` to use MongoDB:

```javascript
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-parking', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Define Mongoose schemas
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['owner', 'user'], required: true },
  name: String,
  phone: String,
  createdAt: { type: Date, default: Date.now }
});

const ParkingAreaSchema = new mongoose.Schema({
  ownerId: { type: String, required: true },
  name: String,
  location: String,
  layoutMatrix: [[Number]],
  slots: [{
    id: String,
    row: Number,
    col: Number,
    status: String,
    bookings: [String]
  }],
  totalSlots: Number,
  pricePerHour: Number,
  vehicleTypes: [String],
  timings: String,
  createdAt: { type: Date, default: Date.now }
});

// Create models
const User = mongoose.model('User', UserSchema);
const ParkingArea = mongoose.model('ParkingArea', ParkingAreaSchema);
// ... create other models
```

## 🔧 Backend Deployment

### 1. Environment Variables

Create `.env` file in backend directory:

```env
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/smart-parking
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
FRONTEND_URL=https://your-domain.com
```

### 2. Update Backend Code

Update CORS settings in `server.js`:

```javascript
const cors = require('cors');

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
```

### 3. Install PM2 (Process Manager)

```bash
npm install -g pm2
```

### 4. Start Backend with PM2

```bash
cd backend
pm2 start server.js --name smart-parking-backend
pm2 save
pm2 startup
```

### 5. Monitor Backend

```bash
pm2 status
pm2 logs smart-parking-backend
pm2 restart smart-parking-backend
```

## 🎨 Frontend Deployment

### Option 1: Deploy to Vercel (Recommended)

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Build frontend:
```bash
cd frontend
npm run build
```

3. Deploy:
```bash
vercel --prod
```

4. Update API URL in frontend:
Create `.env.production` in frontend directory:
```env
REACT_APP_API_URL=https://your-backend-domain.com/api
```

Update `App.js`:
```javascript
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
```

### Option 2: Deploy to Netlify

1. Build frontend:
```bash
cd frontend
npm run build
```

2. Install Netlify CLI:
```bash
npm install -g netlify-cli
```

3. Deploy:
```bash
netlify deploy --prod --dir=build
```

### Option 3: Self-Hosted with Nginx

1. Build frontend:
```bash
cd frontend
npm run build
```

2. Install Nginx:
```bash
sudo apt update
sudo apt install nginx
```

3. Create Nginx configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/smart-parking/frontend/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

4. Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/smart-parking /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 🔒 SSL Certificate Setup

### Using Let's Encrypt (Free)

1. Install Certbot:
```bash
sudo apt install certbot python3-certbot-nginx
```

2. Obtain certificate:
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

3. Auto-renewal:
```bash
sudo certbot renew --dry-run
```

## 🔐 Security Hardening

### 1. Environment Variables

Never commit `.env` files. Use environment variables for:
- JWT_SECRET
- MONGODB_URI
- API keys
- Passwords

### 2. Rate Limiting

Add to `server.js`:

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 3. Helmet.js (Security Headers)

```javascript
const helmet = require('helmet');
app.use(helmet());
```

### 4. Input Validation

```javascript
const { body, validationResult } = require('express-validator');

app.post('/api/auth/register',
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // ... rest of code
  }
);
```

## 📊 Monitoring & Logging

### 1. Application Logs

```bash
# View PM2 logs
pm2 logs smart-parking-backend

# Save logs to file
pm2 logs smart-parking-backend > logs.txt
```

### 2. Error Tracking (Optional)

Integrate Sentry for error tracking:

```javascript
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: 'your-sentry-dsn',
  environment: process.env.NODE_ENV
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

### 3. Analytics (Optional)

Add Google Analytics to frontend:

```html
<!-- In public/index.html -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

## 🚀 Performance Optimization

### 1. Enable Gzip Compression

```javascript
const compression = require('compression');
app.use(compression());
```

### 2. Cache Static Assets

In Nginx config:
```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 3. Database Indexing

```javascript
// Add indexes for frequently queried fields
UserSchema.index({ email: 1 });
ParkingAreaSchema.index({ location: 1, vehicleTypes: 1 });
BookingSchema.index({ userId: 1, status: 1 });
```

## 🔄 Continuous Deployment

### GitHub Actions (Example)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '14'
    
    - name: Install dependencies
      run: |
        cd backend && npm install
        cd ../frontend && npm install
    
    - name: Build frontend
      run: cd frontend && npm run build
    
    - name: Deploy to server
      run: |
        # Your deployment script here
        # e.g., rsync, ssh, etc.
```

## 📋 Pre-Deployment Checklist

- [ ] Database configured and tested
- [ ] Environment variables set
- [ ] SSL certificate installed
- [ ] CORS properly configured
- [ ] Security headers enabled
- [ ] Rate limiting implemented
- [ ] Error logging setup
- [ ] Backup strategy in place
- [ ] Monitoring configured
- [ ] Domain DNS configured
- [ ] Load testing completed
- [ ] Documentation updated

## 🆘 Troubleshooting

### Backend not starting:
```bash
# Check logs
pm2 logs smart-parking-backend

# Check if port is in use
lsof -i :3001

# Restart application
pm2 restart smart-parking-backend
```

### Database connection issues:
```bash
# Test MongoDB connection
mongo "mongodb+srv://cluster.mongodb.net/test" --username your-username

# Check MongoDB logs
tail -f /var/log/mongodb/mongod.log
```

### Frontend not connecting to backend:
- Verify API URL in environment variables
- Check CORS settings
- Verify SSL certificates
- Test API endpoints with curl/Postman

## 📞 Support

For production issues:
1. Check application logs
2. Review error tracking dashboard (Sentry)
3. Monitor server resources
4. Check database status

---

**Ready for Production! 🚀**
