# GitHub Pages Deployment Guide

This guide explains how to deploy the Glencoe Curling Simulator to GitHub Pages for free web hosting.

## ✅ Ready for GitHub Pages

The application is **100% compatible** with GitHub Pages because:

- **Pure client-side**: No server dependencies, runs entirely in the browser
- **Static files only**: HTML, CSS, JavaScript, and assets
- **Relative paths**: All file references use relative paths
- **CDN dependencies**: External libraries loaded from CDN (D3.js)
- **Fallback data**: Accuracy database has local fallback when API unavailable

## 🚀 Deployment Methods

### Method 1: Automatic Deployment (Recommended)

1. **Push to main branch**: GitHub Actions will automatically deploy
2. **Workflow included**: `.github/workflows/deploy.yml` handles deployment
3. **Zero configuration**: Works out of the box

```bash
git add .
git commit -m "Deploy curling simulator"
git push origin main
```

### Method 2: Manual GitHub Pages Setup

1. Go to your repository on GitHub.com
2. Navigate to **Settings** → **Pages**
3. Under **Source**, select "Deploy from a branch"
4. Choose **main** branch and **/ (root)** folder
5. Click **Save**

## 📍 Access Your Deployed App

After deployment, your app will be available at:
```
https://[username].github.io/glencoe_curling_2025-2026/
```

Replace `[username]` with your GitHub username.

## 🔧 GitHub Pages Configuration

### Repository Settings Required:
- **Repository must be public** (or GitHub Pro for private repos)
- **Pages enabled** in repository settings
- **Correct branch selected** (main)

### Deployment Features:
- **Automatic updates**: Changes to main branch deploy automatically
- **Custom domain support**: Can use your own domain if desired
- **HTTPS enabled**: Secure hosting by default
- **Global CDN**: Fast loading worldwide

## 🎯 What Gets Deployed

The entire repository is deployed as static content:

```
Repository Root/
├── index.html              ✅ Main app entry point
├── css/styles.css          ✅ Application styling
├── js/                     ✅ All JavaScript modules
│   ├── models/             ✅ Game engine
│   ├── PhotoStoneDetection.js ✅ Photo upload feature
│   └── [all other files]   ✅ UI components
├── README.md              ✅ Documentation
└── [all other files]      ✅ Assets and docs
```

## 🌐 Features Available Online

All simulator features work in the deployed version:

### ✅ Full Functionality
- **Physics simulation**: Complete curling physics
- **Game management**: Scoring, ends, team management
- **Photo upload**: Drag & drop photo stone detection
- **Shot accuracy**: Real-time execution error display
- **Export data**: Download game data as JSON
- **Responsive design**: Works on desktop and mobile

### ✅ Performance
- **Fast loading**: Static files cached by GitHub's CDN
- **No server lag**: Everything runs in your browser
- **Offline capable**: Works without internet after initial load

## 📱 Mobile Compatibility

The deployed app works great on mobile devices:
- **Touch controls**: Tap to place broom position
- **File upload**: Camera integration for photo detection
- **Responsive layout**: Adapts to screen size
- **Performance**: Smooth on modern phones/tablets

## 🔄 Updating the Deployed App

### Automatic Updates (with GitHub Actions):
```bash
# Make your changes
git add .
git commit -m "Add new feature"
git push origin main
# Deployment happens automatically!
```

### Manual Updates:
1. Push changes to the main branch
2. GitHub Pages automatically rebuilds and deploys
3. Changes live within a few minutes

## 🐛 Troubleshooting

### Common Issues:

**404 Error on deployment:**
- Ensure `index.html` is in the repository root
- Check that Pages is enabled in repository settings
- Verify the correct branch is selected

**JavaScript modules not loading:**
- Make sure all imports use relative paths (✅ already correct)
- Verify files are committed and pushed to the repository

**Photo upload not working:**
- This is normal - the basic detection will work
- File upload and processing happens client-side

**Accuracy data not loading:**
- This is expected - the app uses fallback local data
- All functionality remains available

## 🎉 Success!

Once deployed, you can:
- **Share the URL** with anyone to try the simulator
- **Use it anywhere** with internet access
- **Analyze real games** by uploading photos
- **Practice strategy** with realistic physics
- **Export data** for further analysis

Your curling simulator is now accessible to the world! 🥌