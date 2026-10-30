import { redirect } from 'next/navigation';
import { loyaltyControllerGetMyLoyalty } from '@brewlite/api-client';
import { PointsSummary } from '@/components/account/PointsSummary';
import { ProfileForm } from '@/components/account/ProfileForm';
import { SignInMethod } from '@/components/account/SignInMethod';
import { SignOutButton } from '@/components/SignOutButton';
import { getT } from '@/i18n/server';
import { getMe } from '@/lib/me';
import { withRequestId } from '@/lib/with-request-id';

export async function generateMetadata() {
  const { t } = await getT('account');
  return { title: t('title') };
}

/** `/account` — name, points, how you sign in. Staff and admins see the same page. */
export default async function AccountPage() {
  const [{ t }, me, loyalty] = await Promise.all([
    getT('account'),
    getMe(),
    loyaltyControllerGetMyLoyalty().catch((error: unknown) => {
      throw withRequestId(error);
    }),
  ]);
  if (!me) redirect('/login?next=/account');
  const points = loyalty.status === 200 ? loyalty.data.data : undefined;
  if (!points) throw new Error('GET /loyalty/me answered without a ledger');

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 py-4 lg:py-8">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <ProfileForm fullName={me.fullName} email={me.email} />
      <PointsSummary loyalty={points} />
      <SignInMethod hasPassword={me.hasPassword} />
      <SignOutButton />
    </div>
  );
}
