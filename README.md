# Daily-Meal

Daily-Meal is a mobile-first recipe PWA for saving, organizing, searching, and managing personal recipes.

# Features

- Login, signup, forgot password
- Recipe add, edit, delete
- Multiple recipe images with preview, update, delete, and reorder
- Ingredients, quantities, and cooking instructions
- Categories and tags
- Search, filters, and sorting
- Favorites and recently viewed recipes
- Recipe sharing
- PDF generation and printing
- Offline access to saved recipes
- Light and dark mode
- Responsive mobile-first interface

# Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Firebase Authentication
- Firebase Firestore
- Cloudinary image storage
- IndexedDB
- PWA

## Getting Started

First, clone the repository:

```bash
git clone https://github.com/NabeelMughal/Daily-Meal.git
cd Daily-Meal
```

Install the dependencies:

```bash
npm install
```

Create a `.env.local` file and add your Firebase configuration:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

Run the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

# Links

- [GitHub Repository](https://github.com/NabeelMughal/Daily-Meal)
- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
