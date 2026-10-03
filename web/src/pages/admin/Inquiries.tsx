import { useEffect, useState } from "react";
import { api, type DateRange, type Inquiry } from "../../lib/api";
import { matches, type Filters } from "./filters";
import { budgetLabel, dateTime } from "./format";
import { Avatar, Empty, Loading, ServiceTag } from "./ui";

export default function Inquiries({ range, filters }: { range: DateRange; filters: Filters }) {
  const [items, setItems] = useState<Inquiry[] | null>(null);
  const { from, to } = range;
  useEffect(() => {
    let live = true; // ignore a slower response for a range the admin has already changed
    api.inquiries({ from, to }).then(
      (r) => live && setItems(r),
      () => live && setItems([]),
    );
    return () => {
      live = false;
    };
  }, [from, to]);

  if (!items) return <Loading />;
  if (!items.length) return <Empty>{from || to ? "No inquiries in this date range." : "No inquiries yet."}</Empty>;

  const visible = items.filter(
    (q) => (filters.service === "all" || q.service === filters.service) && matches(filters.q, q.name, q.company, q.email, q.message),
  );

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        {visible.length === items.length ? `${items.length} inquiries` : `${visible.length} of ${items.length} inquiries`}
      </p>
      {!visible.length ? (
        <Empty>No inquiries match these filters.</Empty>
      ) : (
        <ul className="grid gap-3" aria-label="Inquiries">
          {visible.map((q) => (
            <li key={q.id} className="card p-4 md:p-5" data-testid="inquiry">
              <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                <Avatar name={q.name} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {q.name}
                    {q.company && <span className="font-normal text-muted"> · {q.company}</span>}
                  </p>
                  <a className="text-sm text-accent hover:underline" href={`mailto:${q.email}`}>
                    {q.email}
                  </a>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  <ServiceTag service={q.service} />
                  <span className="tag tag-other">{budgetLabel(q.budget)}</span>
                  <time dateTime={q.created_at} className="ms-1 whitespace-nowrap">
                    {dateTime(q.created_at)}
                  </time>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed md:ps-12">{q.message}</p>
              {q.ai_brief && (
                <details className="group mt-3 rounded-md bg-[var(--sunken)] px-3 py-2 md:ms-12">
                  <summary className="cursor-pointer text-sm font-medium text-muted marker:text-muted">AI brief · edited by client</summary>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{q.ai_brief}</p>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
