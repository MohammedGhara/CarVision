# CarVision - New Features Setup Instructions

## New Features Added

1. **Vehicle Management** - Garages can now add, edit, and delete vehicles
2. **Chat System** - Clients and garages can chat with each other

## Database Migration Required

Before using these features, you need to run the database migration:

```bash
cd CarVision/apps/server
npx prisma migrate dev --name add_vehicles_and_messages
```

Or if you prefer to run the migration manually:

```bash
cd CarVision/apps/server
npx prisma db push
```

This will create the `Vehicle` and `Message` tables in your database.

## Features Overview

### Vehicle Management (Garage Only)
- **Location**: Garage Dashboard → "Manage Vehicles"
- **Features**:
  - Add new vehicles (Make, Model, Year, VIN, License Plate, Color, Mileage, Notes)
  - Edit existing vehicles
  - Delete vehicles
  - View all vehicles in a list

### Chat System (Client ↔ Garage)
- **For Clients**: Home → "Chat with Garage"
- **For Garages**: Garage Dashboard → "Manage Clients"
- **Features**:
  - View all conversations
  - See all users of opposite role
  - Send and receive messages
  - Real-time message polling (updates every 3 seconds)
  - Unread message count
  - Message timestamps

## API Endpoints

### Vehicles
- `GET /api/vehicles` - Get all vehicles for authenticated garage
- `GET /api/vehicles/:id` - Get specific vehicle
- `POST /api/vehicles` - Create new vehicle
- `PUT /api/vehicles/:id` - Update vehicle
- `DELETE /api/vehicles/:id` - Delete vehicle

### Messages
- `GET /api/messages/conversations` - Get all conversations
- `GET /api/messages/:userId` - Get messages with specific user
- `POST /api/messages` - Send a message
- `GET /api/messages/users/:role` - Get all users of specific role (CLIENT or GARAGE)

## Notes

- Vehicles are owned by garages (stored with `ownerId`)
- Messages can only be sent between CLIENT and GARAGE roles (not between same roles)
- Messages are automatically marked as read when viewing a conversation
- Chat uses polling (3-second intervals) for new messages


