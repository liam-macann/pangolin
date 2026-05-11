export default async function Layout({ children }: { children: React.ReactNode }) {
	return (
		<main className='flex min-h-screen items-center justify-center bg-gray-2 dark:bg-gray-1'>
			<div className='flex w-full max-w-[600px] flex-col items-stretch gap-4 px-2 py-4'>
				{children}
			</div>
		</main>
	);
}
