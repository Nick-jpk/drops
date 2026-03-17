# Complete Render Deployment Guide

## 🚀 Step-by-Step Deployment Instructions

### **STEP 1: Create Render Account**
1. Go to: https://render.com
2. Click **"Sign Up"**
3. Sign up with GitHub (recommended - easier!)
4. Authorize Render to access your GitHub

### **STEP 2: Create New Web Service**
1. Go to: https://render.com/dashboard
2. Click **"New +"** button (top right)
3. Select **"Web Service"**

### **STEP 3: Connect GitHub Repository**
1. Click **"Connect Repository"**
2. Search for: **drops** (or **Nick-jpk/drops**)
3. Click **"Connect"** next to your repository
4. You may need to authorize Render to access your GitHub

### **STEP 4: Configure the Service**

Fill in these fields:

| Field | Value |
|-------|-------|
| **Name** | `dj-drops-backend` |
| **Environment** | `Node` |
| **Region** | `Oregon (US West)` (or closest to you) |
| **Branch** | `main` |
| **Build Command** | `cd backend && npm install` |
| **Start Command** | `cd backend && npm start` |
| **Plan** | `Free` |

### **STEP 5: Add Environment Variables**

Click **"Add Environment Variable"** and add these:

1. **First Variable:**
   - Key: `NODE_ENV`
   - Value: `production`
   - Click **"Add"**

2. **Second Variable:**
   - Key: `PORT`
   - Value: `3001`
   - Click **"Add"**

3. **Third Variable (Optional - for ElevenLabs):**
   - Key: `ELEVENLABS_API_KEY`
   - Value: `sk_98f68a2a4538384ad19fab4b417c46668297f4ab4668cac1`
   - Click **"Add"**

### **STEP 6: Deploy**
1. Click **"Create Web Service"** button
2. Wait for deployment (2-5 minutes)
3. You'll see logs showing the build process
4. When complete, you'll see a green checkmark ✅

### **STEP 7: Get Your Backend URL**
1. Look at the top of the page
2. You'll see a URL like: `https://dj-drops-backend.onrender.com`
3. **Copy this URL** - you'll need it for the frontend!

---

## ✅ Verification Checklist

After deployment:

- [ ] Service shows green status (✓)
- [ ] No errors in the logs
- [ ] URL is accessible
- [ ] Test the API: Visit `https://your-url.onrender.com/api/health`

---

## 🔗 Connect Frontend to Backend

Once your backend is deployed:

1. **Copy your Render URL** (e.g., `https://dj-drops-backend.onrender.com`)
2. **Go to Vercel Dashboard:** https://vercel.com/dashboard
3. **Click your "drops" project**
4. **Click "Settings"**
5. **Go to "Environment Variables"**
6. **Add this variable:**
   - Key: `VITE_API_URL`
   - Value: `https://dj-drops-backend.onrender.com/api`
7. **Click "Save"**
8. **Go to "Deployments"**
9. **Click "Redeploy"** on the latest deployment
10. **Wait for deployment to complete**

---

## 🎯 Final URLs

After everything is set up:

- **Frontend:** `https://drops-xxx.vercel.app`
- **Backend:** `https://dj-drops-backend.onrender.com`
- **API:** `https://dj-drops-backend.onrender.com/api`

---

## 🔧 Troubleshooting

### Backend won't deploy?
- Check the build logs in Render
- Make sure `npm install` completes successfully
- Verify `backend/package.json` exists

### Getting 502 Bad Gateway?
- Backend might still be starting
- Wait 30 seconds and refresh
- Check Render logs for errors

### Frontend can't reach backend?
- Make sure `VITE_API_URL` is set correctly in Vercel
- Make sure it includes `/api` at the end
- Verify backend is running (green status in Render)

### Still having issues?
- Check browser console (F12) for errors
- Check Render logs for backend errors
- Verify all environment variables are set correctly

---

## 📞 Support

- **Render Docs:** https://render.com/docs
- **Vercel Docs:** https://vercel.com/docs
- **GitHub Issues:** Add issues to your repository

---

## 🎉 Success!

Once everything is deployed and connected:
1. Go to your Vercel frontend URL
2. Upload an audio sample
3. Enter text
4. Click "Generate DJ Drop"
5. Download your creation!

Enjoy your DJ Drops application! 🎧
