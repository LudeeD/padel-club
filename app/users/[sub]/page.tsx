import Image from "next/image";

import moment from "moment";
import { getServerSession } from "next-auth/next";

import Actions from "./actions";
import Address from "@/app/address";
import { Participants } from "@/app/events";
import { generateMonogram, stringToColor } from "@/helpers/utils";

import Navigation from "../../navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

import getDb from "@/helpers/getDb";
const { db } = getDb();

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "default-no-store";

export default async function UserProfile({
  params,
}: {
  params: { sub: string };
}) {
  const { sub } = params;

  const session = await getServerSession(authOptions);

  const user = await db.one(
    "SELECT id, name, avatar, created, sub FROM users WHERE sub = $1",
    sub
  );

  if ((session?.user as any).sub !== user.sub) {
    return (
      <div className="flex flex-col gap-2 max-w-md w-full">
        <Navigation />
        <div className="text-lg mt-10">
          You don&apos;t have access to this page. ⛔️
        </div>
      </div>
    );
  }

  const sessions = await db.task(async (t) => {
    const sessions_users = await t.any(
      `SELECT * FROM sessions_users WHERE "user" = $1 ORDER BY "session" DESC`,
      user.id
    );

    const sessions = Promise.all(
      sessions_users.map(async (su: any) => {
        const session = await t.one(
          `SELECT * FROM sessions WHERE id = $1`,
          su.session
        );

        const participants = await t.any(
          `SELECT u.name, u.avatar FROM sessions_users su
          INNER JOIN users u ON su.user = u.id
          WHERE su.session = $1
          ORDER BY su.created ASC`,
          [session.id]
        );

        return { ...session, participants, paid: su.paid };
      })
    );

    // sort sessions by start date
    const sortedSessions = (await sessions).sort((a: any, b: any) =>
      moment(a.start).isBefore(moment(b.start)) ? -1 : 1
    );

    return sortedSessions;
  });

  const numSessionsInPast = sessions.filter((s: any) =>
    moment(s.start).isBefore(moment())
  ).length;
  const upcomingSessions = sessions.filter((s: any) =>
    moment(s.start).isAfter(moment())
  );

  return (
    <div className="flex flex-col gap-2 max-w-md w-full">
      <Navigation />

      <div className="flex flex-row justify-between items-center">
        <div className="flex flex-col gap-2">
          <div className="text-4xl text-yellow-400 font-bold">{user.name}</div>
          <div className="text-lg">
            Joined {moment(user.created).format("LL")}
          </div>
        </div>

        {user.avatar ? (
          <Image
            width={96}
            height={96}
            className="h-24 w-24 rounded-full"
            src={user.avatar}
            alt={user.name}
          />
        ) : (
          <div
            className="flex w-24 h-24 rounded-full font-medium items-center justify-center"
            style={{ backgroundColor: stringToColor(user.name) }}
          >
            {generateMonogram(user.name)}
          </div>
        )}
      </div>

      <div className="bg-yellow-900 rounded-lg mt-10 p-2">
        {numSessionsInPast > 0 ? (
          <div className="text-lg">
            You&apos;ve been part of{" "}
            <div className="inline-flex text-2xl px-1 text-yellow-400 font-medium animate-bounce">
              {numSessionsInPast}
            </div>{" "}
            session
            {numSessionsInPast > 1
              ? "s. Way to go! 🥳"
              : " already. See you on the next one!"}
          </div>
        ) : (
          <div>
            <div className="text-lg mt-10">
              You haven&apos;t been part of any sessions yet. 😢
            </div>
          </div>
        )}
      </div>

      <h1 className="text-3xl text-slate-400 font-medium mt-10">Upcoming</h1>
      <div className="flex flex-col divide-y-2 divide-slate-800">
        {upcomingSessions.length === 0 && (
          <div className="text-slate-300">
            You don&apos;t have any upcoming sessions. 😢
          </div>
        )}

        {upcomingSessions.map((session: any) => {
          return (
            <div
              key={session.id}
              className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4 py-4 sm:py-2"
            >
              <div className="flex flex-col gap-1">
                <h2 className="text-xl text-slate-400 font-medium">
                  {session.title}
                </h2>

                <Participants participants={session.participants} />

                <div className="flex flex-row gap-2">
                  <p
                    className={
                      "text-sm font-medium px-1 py-0.5 rounded " +
                      (session.booked
                        ? "bg-yellow-400 text-yellow-900"
                        : "text-yellow-400 border border-yellow-400")
                    }
                  >
                    {session.booked ? "booked" : "scheduled"}
                  </p>
                  <div className="inline border border-slate-400 text-slate-400 rounded text-sm px-1 py-0.5">
                    {session.price} DKK
                  </div>
                  <p className="inline border border-slate-400 text-slate-400 rounded text-sm px-1 py-0.5">
                    {session.duration} min
                  </p>
                </div>

                <div>{moment(session.start).format("LLLL")}</div>

                <Address address={session.location} />
              </div>
            </div>
          );
        })}
      </div>

      <Actions userId={user.id} />
    </div>
  );
}
