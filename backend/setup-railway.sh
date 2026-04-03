#!/bin/bash
# Quick Setup Script for Railway Deployment

set -e

echo "🚀 MPS Control Dashboard - Railway Production Setup"
echo "=" * 50

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Install dependencies
echo -e "${YELLOW}Step 1: Installing dependencies...${NC}"
cd backend
pip install -r requirements.txt
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Step 2: Create environment file
echo -e "${YELLOW}Step 2: Setting up environment...${NC}"
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}✅ Created .env file (update with your values)${NC}"
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

# Step 3: Test locally
echo -e "${YELLOW}Step 3: Testing API locally...${NC}"
echo "Starting development server..."
echo "URL: http://localhost:8000"
echo "Docs: http://localhost:8000/docs"
echo ""
echo "Commands:"
echo "  - Start server: uvicorn main:app --reload"
echo "  - Run tests: python test_api.py http://localhost:8000 data.csv"
echo "  - Health check: curl http://localhost:8000/health"
echo ""

# Step 4: Deployment instructions
echo -e "${YELLOW}Step 4: Deployment to Railway${NC}"
echo ""
echo "Instructions:"
echo "1. Push changes to git:"
echo "   git add -A"
echo "   git commit -m 'Refactor: Async file upload for Railway'"
echo "   git push"
echo ""
echo "2. In Railway dashboard (https://railway.app):"
echo "   - Connect your repository"
echo "   - Set root directory to '.'"
echo "   - Add environment variables:"
echo "     * ENVIRONMENT=production"
echo "     * DEBUG=false"
echo "     * REQUEST_TIMEOUT=30"
echo "     * UPLOAD_TIMEOUT=60"
echo "     * DATA_TIMEOUT=120"
echo ""
echo "3. Deploy:"
echo "   - Railway will auto-deploy on git push"
echo "   - Check logs for errors"
echo ""

echo -e "${GREEN}✨ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Test locally: uvicorn main:app --reload"
echo "2. Deploy to Railway"
echo "3. Monitor: railway logs --follow"
echo ""
