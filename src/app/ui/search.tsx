'use client';

import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';
import { Input } from '@/ui/input';

export default function Search({
	placeholder,
	className,
}: {
	placeholder: string;
	className?: string;
}) {
	const searchParams = useSearchParams();
	const pathname = usePathname();
	const { replace } = useRouter();

	const handleSearch = useDebouncedCallback(term => {
		const params = new URLSearchParams(searchParams);

		if (term) params.set('query', term);
		else params.delete('query');

		replace(`${pathname}?${params.toString()}`);
	}, 50);

	return (
		<Input
			className={className}
			aria-label='Search'
			placeholder={placeholder}
			onChange={e => handleSearch(e.target.value)}
			defaultValue={searchParams.get('query')?.toString()}
			prefix={<MagnifyingGlassIcon />}
		/>
	);
}
