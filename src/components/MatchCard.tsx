'use client';

import Image from 'next/image';
import Link from 'next/link';

interface Match {
  id: string;
  name: string;
  age: number;
  avatar_url?: string;
  bio?: string;
  distance_km?: number;
  trust_score?: number;
}

export default function MatchCard({ match }: { match: Match }) {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
      <div className="relative h-64 bg-gray-200">
        {match.avatar_url ? (
          <Image
            src={match.avatar_url}
            alt={match.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-300 text-gray-500">
            No photo
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-xl font-bold mb-2">
          {match.name}, {match.age}
        </h3>

        {match.distance_km !== undefined && (
          <p className="text-sm text-gray-600 mb-2">
            📍 {match.distance_km} km away
          </p>
        )}

        {match.trust_score !== undefined && (
          <p className="text-sm text-gray-600 mb-4">
            ⭐ Trust Score: {match.trust_score}%
          </p>
        )}

        {match.bio && (
          <p className="text-sm text-gray-700 mb-4 line-clamp-3">{match.bio}</p>
        )}

        <div className="flex gap-2">
          <Link
            href={`/matches/${match.id}`}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-center"
          >
            View Profile
          </Link>
          <button className="flex-1 border border-gray-300 hover:border-gray-400 py-2 px-4 rounded-lg">
            💬 Message
          </button>
        </div>
      </div>
    </div>
  );
}
