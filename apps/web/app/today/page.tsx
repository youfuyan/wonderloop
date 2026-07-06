import Link from "next/link";

import { BilingualCopy } from "../auth/bilingual-copy";

export default function TodayPage() {
  return (
    <main className="authPage">
      <section className="authPanel todayPanel">
        <div className="authHeader">
          <h1>
            <BilingualCopy messageKey="todayPlaceholderTitle" />
          </h1>
          <p>
            <BilingualCopy messageKey="todayPlaceholderSubtitle" />
          </p>
        </div>
        <Link className="linkButton" href="/settings">
          <BilingualCopy messageKey="goToSettings" />
        </Link>
      </section>
    </main>
  );
}
