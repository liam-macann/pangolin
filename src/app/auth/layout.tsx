export default async function Layout({ children }: { children: React.ReactNode }) {
	return (
		<main className='flex min-h-screen items-center justify-center bg-gray-2 px-8'>
			<div className='flex w-full max-w-md flex-col items-stretch gap-4 py-4'>{children}</div>
		</main>
	);
}
