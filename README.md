# 🍽️ MessKhata

> **Digital Ledger for Indian Mess Services**

MessKhata is a modern SaaS platform built to replace traditional paper registers used in Indian mess facilities. It provides a secure, efficient, and user-friendly digital system for managing customer subscriptions, meal consumption, and daily operations.

Designed with a **thumb-friendly interface**, MessKhata enables even non-technical staff to manage customers and track meals with speed, accuracy, and confidence.

---

# 🚀 Tech Stack

### Frontend
- React
- Tailwind CSS
- Lucide Icons

### Backend & Database
- Supabase
  - PostgreSQL
  - Authentication
  - Storage

### Security
- Supabase Row Level Security (RLS)
- Multi-Tenant Architecture

### Deployment
- GitHub (Version Control)
- Vercel (CI/CD & Hosting)

---

# ✨ Core Features

## 🔐 Multi-Tenant SaaS Architecture
Each mess owner operates within a completely isolated workspace. PostgreSQL Row Level Security (RLS) ensures that administrators can only access and manage their own customer data.

## 📦 Hybrid Subscription Engine
Supports multiple subscription models:

- Token-based plans (e.g., 30 Plates, 56 Plates)
- Time-based plans (e.g., 30 Days, 45 Days)
- Flexible renewals and plan extensions

## 🍽️ One-Tap Meal Attendance
Fast and intuitive meal tracking through a color-coded interface.

- Single tap to deduct a meal
- Instant attendance logging
- Timestamped consumption records

## ⚡ Instant Customer Search
Optimized PostgreSQL indexing enables lightning-fast search by:

- Customer Name
- Customer ID
- Mobile Number

## 💬 WhatsApp Reminders
Built-in WhatsApp integration using the `wa.me` API allows administrators to instantly notify customers regarding renewals and plan expirations without any additional messaging costs.

---

# 🛠️ Recent Enhancements & Optimizations

## 🧹 Automated Database Cleanup
To maintain performance and reduce storage costs, expired customer records are automatically removed if a subscription remains inactive for more than **3 months** after expiration.

### Benefits
- Cleaner database
- Faster queries
- Reduced storage consumption

---

## ↩️ Fail-Safe Attendance System
To minimize accidental meal deductions:

### Improvements
- Added **"Add Plate (Undo)"** functionality for quick corrections.
- Relocated the primary **EAT** button to the bottom of the customer card.
- Expanded the EAT button to **full width (100%)** for easier accessibility.

### Result
Reduced user errors and improved usability for non-technical staff.

---

## 📊 Real-Time Dashboard Analytics
The dashboard now calculates and displays:

- Total meals consumed today
- Live meal consumption metrics
- Accurate daily operational insights

The `mealsToday` metric updates automatically based on attendance records.

---

## 📸 Native Camera Integration
Customer registration is now faster and more convenient.

### Features
- Direct camera access from supported devices
- Capture customer photos during registration
- Eliminates manual image uploads and URL pasting

Implemented within `AddCustomerModal.tsx`.

---

## 📱 Proactive SMS Notifications
Automated SMS reminders are sent before subscription expiry.

### Trigger Conditions
- Only **5 plates remaining**
- Only **3 days remaining before expiry**

This helps improve customer retention and reduces unexpected service interruptions.

---

## ⚡ Optimized Rendering & Smart Caching
Customer creation and renewal workflows have been significantly optimized.

### Previous Behavior
- Full customer list refetch after updates

### Current Behavior
- Optimistic UI updates
- Targeted state management
- Minimal network requests

### Benefits
- Faster page loads
- Reduced bandwidth usage
- Better user experience

---

# 🔒 Security & Data Isolation

MessKhata relies heavily on Supabase Row Level Security (RLS) to guarantee complete tenant isolation.

Each customer record is associated with an `admin_id`.

### Example RLS Policy

```sql
CREATE POLICY "Admins only see their own data"
ON customers
FOR ALL
USING (auth.uid() = admin_id);
```

This ensures administrators can only view and modify records that belong to them.

---

# 📂 Project Structure

```bash
app/
components/
hooks/
lib/
public/
supabase/
```

---

# 💻 Getting Started

## 1. Clone the Repository

```bash
git clone https://github.com/your-username/messkhata.git
cd messkhata
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 4. Start Development Server

```bash
npm run dev
```

## 5. Open the Application

Visit:

```text
http://localhost:3000
```

---

# 🎯 Mission

MessKhata aims to digitize small and medium-scale mess operations across India by providing a simple, reliable, and affordable management platform that eliminates paperwork, reduces operational mistakes, and improves customer management.

---

# 📄 License

This project is proprietary software unless otherwise specified by the repository owner.
