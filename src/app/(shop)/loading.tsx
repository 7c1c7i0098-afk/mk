export default function HomeLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <div className="flex gap-2">
          <div className="skeleton h-11 w-32 rounded-2xl" />
          <div className="skeleton size-11 rounded-2xl" />
        </div>
        <div className="skeleton h-12 w-full rounded-2xl md:flex-1" />
      </div>

      <div className="skeleton aspect-16/9 w-full rounded-3xl sm:aspect-[16/6.5] lg:aspect-[16/5]" />

      <div className="-mx-2 grid grid-cols-4 gap-2 sm:mx-0 sm:gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex flex-col items-center gap-2">
            <div className="skeleton aspect-square w-full rounded-2xl" />
            <div className="skeleton h-3 w-3/5 rounded-full" />
          </div>
        ))}
      </div>

      <div className="space-y-3.5">
        <div className="skeleton h-5 w-24 rounded-full" />
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <div className="skeleton aspect-square w-full rounded-2xl" />
              <div className="skeleton mx-auto h-3 w-2/3 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
