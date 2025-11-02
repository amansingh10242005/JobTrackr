# JobTrackr - Setup and Run Guide

This is a full-stack job tracking application with a Node.js server and a Next.js client.

## Project Structure

- **`server/`** - Node.js HTTP server with Firebase backend
- **`client/`** - Next.js React frontend application

## Prerequisites

- **Node.js** (v14 or higher recommended)
- **npm** (comes with Node.js)
- **Firebase project** with Firestore database enabled
- **Firebase service account** JSON file

## Setup Instructions

### 1. Server Setup

Navigate to the server directory:
```bash
cd server
```

Install dependencies:
```bash
npm install
```

#### Environment Variables

Create a `.env` file in the `server/` directory with the following variables:

```env
PORT=5000
JWT_SECRET=your-secret-jwt-key-here
NODE_ENV=development

# Firebase configuration (if needed beyond serviceAccount.json)
# Firebase config is loaded from serviceAccount.json

# Email configuration (for notifications/password reset)
# Add email service credentials if you plan to use email features
```

**Note**: The server already has `serviceAccount.json` for Firebase Admin SDK authentication.

### 2. Client Setup

Navigate to the client directory:
```bash
cd client
```

Install dependencies:
```bash
npm install
```

#### Environment Variables (if needed)

If the client needs to connect to the server, you may need to create a `.env.local` file in the `client/` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Running the Application

### Option 1: Run Server and Client Separately (Recommended)

**Terminal 1 - Start the Server:**
```bash
cd server
npm run dev
```
The server will run on `http://localhost:5000` (or the PORT specified in `.env`)

**Terminal 2 - Start the Client:**
```bash
cd client
npm run dev
```
The client will run on `http://localhost:3000`

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Option 2: Production Mode

**Build and run the client:**
```bash
cd client
npm run build
npm start
```

**Run the server in production:**
```bash
cd server
npm start
```

## Available Scripts

### Server Scripts
- `npm start` - Run the server
- `npm run dev` - Run the server with nodemon (auto-restart on changes)

### Client Scripts
- `npm run dev` - Start Next.js development server
- `npm run build` - Build the production bundle
- `npm start` - Start the production server
- `npm run lint` - Run ESLint

## API Endpoints

The server provides the following API endpoints:

- **Authentication**: `/api/users/*` (register, login, etc.)
- **Tasks**: `/api/tasks/*`
- **Notifications**: `/api/notifications/*`
- **Calendar**: `/api/calendar/*`
- **Teams**: `/api/teams/*`
- **Projects**: `/api/projects/*`

## Troubleshooting

### Server won't start
1. Check if `PORT` in `.env` is available (default: 5000)
2. Verify `serviceAccount.json` exists in the `server/` directory
3. Ensure all dependencies are installed: `npm install`
4. Check that `JWT_SECRET` is set in `.env`

### Client won't start
1. Make sure port 3000 is not in use
2. Verify all dependencies are installed: `npm install`
3. Check for any linting errors: `npm run lint`

### Connection issues
- Ensure the server is running before starting the client
- Verify the API URL in the client matches the server port
- Check CORS settings if accessing from a different origin

## Development Notes

- The server uses Firebase Firestore for data storage
- Authentication uses JWT tokens
- The client is a Next.js application with server-side rendering
- Both services need to run simultaneously for full functionality

