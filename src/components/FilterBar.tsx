'use client';

interface Filters {
  distance: number;
  ageMin: number;
  ageMax: number;
  minTrustScore: number;
}

interface FilterBarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

export default function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-bold mb-4">Filters</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Distance: {filters.distance} km
          </label>
          <input
            type="range"
            min="1"
            max="500"
            value={filters.distance}
            onChange={(e) =>
              onFiltersChange({ ...filters, distance: parseInt(e.target.value) })
            }
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Min Age: {filters.ageMin}
          </label>
          <input
            type="range"
            min="18"
            max="99"
            value={filters.ageMin}
            onChange={(e) =>
              onFiltersChange({ ...filters, ageMin: parseInt(e.target.value) })
            }
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Age: {filters.ageMax}
          </label>
          <input
            type="range"
            min="18"
            max="99"
            value={filters.ageMax}
            onChange={(e) =>
              onFiltersChange({ ...filters, ageMax: parseInt(e.target.value) })
            }
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Min Trust Score: {filters.minTrustScore}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={filters.minTrustScore}
            onChange={(e) =>
              onFiltersChange({ ...filters, minTrustScore: parseInt(e.target.value) })
            }
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
