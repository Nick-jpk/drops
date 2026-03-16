# Environment Variables Setup Guide

## 🔐 Render Backend Environment Variables

### Step 1: Access Render Dashboard
1. Go to: https://render.com/dashboard
2. Click on your **dj-drops-backend** service
3. Click the **"Environment"** tab on the left sidebar

### Step 2: Add Environment Variables

Click **"Add Environment Variable"** for each variable below:

#### Required Variables:

| Variable Name | Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Sets the environment to production mode |
| `PORT` | `3001` | Port for the backend server |

### Step 3: Save and Deploy

1. After adding variables, click **"Save"**
2. Render will automatically redeploy your service
3. Wait 2-3 minutes for deployment to complete
4. Check the **"Logs"** tab to verify it's running

## 🌐 Vercel Frontend Configuration

### Step 1: Access Vercel Dashboard
1. Go to: https://vercel.com/dashboard
2. Click on your **drops** project
3. Click **"Settings"** tab

### Step 2: Add Environment Variables

Go to **"Environment Variables"** section and add:

#### Required Variables:

| Variable Name | Value | Description |
|---|---|---|
| `VITE_API_URL` | `https://dj-drops-backend.onrender.com/api` | Your Render backend URL |

**Note:** Replace `https://dj-drops-backend.onrender.com` with your actual Render backend URL

### Step 3: Deploy

1. After adding variables, click **"Save"**
2. Go to **"Deployments"** tab
3. Click **"Redeploy"** on the latest deployment
4. Wait for deployment to complete

## 📋 Summary

### Render Backend Variables:
```
NODE_ENV = production
PORT = 3001
```

### Vercel Frontend Variables:
```
VITE_API_URL = https://dj-drops-backend.onrender.com/api
```

## ✅ Verification

After setting up variables:

1. **Check Render logs** - Should show "Server running on port 3001"
2. **Check Vercel deployment** - Should complete successfully
3. **Test the app** - Go to your Vercel URL and try generating a drop
4. **Check browser console** - Should show no errors (F12 to open)

## 🔗 Getting Your Render Backend URL

1. Go to Render dashboard
2. Click on **dj-drops-backend** service
3. Look at the top of the page
4. You'll see a URL like: `https://dj-drops-backend.onrender.com`
5. Copy this URL and use it in Vercel's `VITE_API_URL` variable

## 🚀 Final Checklist

- [ ] Render backend deployed
- [ ] Render environment variables set (NODE_ENV, PORT)
- [ ] Render service is running (check logs)
- [ ] Render backend URL copied
- [ ] Vercel environment variables set (VITE_API_URL)
- [ ] Vercel redeployed
- [ ] Frontend loads successfully
- [ ] Backend connection works
- [ ] DJ drop generation works!

## 📞 Troubleshooting

**Backend not starting?**
- Check Render logs for errors
- Verify NODE_ENV and PORT are set correctly

**Frontend can't reach backend?**
- Check VITE_API_URL is correct
- Make sure Render backend URL is accessible
- Check browser console for CORS errors

**Still having issues?**
- Verify all variables are exactly as shown above
- Check that Render service is running (green status)
- Verify Vercel deployment completed successfully
