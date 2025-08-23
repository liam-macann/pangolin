'use client';

import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/ssr';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';

import { Input } from '@/ui/input';

export default function Search({ placeholder }: { placeholder: string }) {
	const searchParams = useSearchParams();
	const pathname = usePathname();
	const { replace } = useRouter();

	const handleSearch = useDebouncedCallback(term => {
		const params = new URLSearchParams(searchParams);
		params.set('page', '1');

		if (term) {
			params.set('query', term);
		} else {
			params.delete('query');
		}
		replace(`${pathname}?${params.toString()}`);
	}, 300);

	return (
		<div className='relative flex flex-1 shrink-0'>
			<label htmlFor='search' className='sr-only'>
				Search
			</label>
			<Input
				className='pl-10'
				placeholder={placeholder}
				onChange={e => {
					handleSearch(e.target.value);
				}}
				defaultValue={searchParams.get('query')?.toString()}
			/>
			<MagnifyingGlassIcon className='-translate-y-1/2 absolute top-1/2 left-3 h-[18px] w-[18px]' />
		</div>
	);
}
