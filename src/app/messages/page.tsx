import { redirect } from 'next/navigation';

// /messages redirects to the matches list since matches are the primary entry point
export default function MessagesPage() {
  redirect('/matches');
}
