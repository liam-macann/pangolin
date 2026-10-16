'use client';

import { WarningIcon } from '@phosphor-icons/react/ssr';
import { isValidCountryCode } from 'lib-address';
import { type ComponentProps, Suspense, useDeferredValue } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { type Control, useWatch } from 'react-hook-form';
import type z from 'zod';

import { type Address, type AddressMetadata } from '@/api/dto/address';
import { useAddressMetadata } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import type schema from '@/lib/validation/address';

import { Alert, AlertTitle } from '@/ui/alert';
import { FieldSet } from '@/ui/field';

import { Country, FIELD_MAPPING, type FieldProps } from './fields';

type AddressField = z.input<typeof schema>;
export interface FormValues {
	address: AddressField | null;
}

/** Generic address format including standard international fields
 * @remarks Intentionally deviates from Google 'ZZ' fmt, to more closely mirror regions in loading skeleton
 */
const intlFmt = '%N%n%O%n%A%n%C, %S %Z';

export function AddressInput<T extends FormValues>({
	control: _control,
	disabled,
}: {
	control: Control<T>;
	disabled?: boolean;
}) {
	// Necessary, as RHF can't extract typings from the generic
	const control = _control as unknown as Control<FormValues>;
	const region = useWatch({ name: 'address.country', control });

	return (
		<FieldSet
			className={cn(
				'isolate min-w-0 gap-0 rounded-md border border-dotted bg-background dark:bg-secondary',
				'transition duration-150 ease-out-quart',
				disabled &&
					'cursor-not-allowed bg-muted opacity-50 *:pointer-events-none **:disabled:opacity-100!',
			)}
		>
			<ErrorBoundary
				resetKeys={[region]}
				fallback={
					<Alert variant='destructive' className='m-2 w-auto!'>
						<WarningIcon />
						<AlertTitle>
							Something went wrong! Check your network connection and try again later.
						</AlertTitle>
					</Alert>
				}
			>
				<AddressFields disabled={disabled} region={region} />
			</ErrorBoundary>

			<Country disabled={disabled} />
		</FieldSet>
	);
}

function AddressFields({ region, disabled, ...props }: ComponentProps<typeof LocaleFields>) {
	if (!region) return <FieldLayout disabled={disabled} metadata={{ fmt: intlFmt }} />;

	return (
		<Suspense fallback={<FieldLayout loading metadata={{ fmt: intlFmt }} />}>
			<LocaleFields disabled={disabled} region={region} {...props} />
		</Suspense>
	);
}

/** Takes an ISO2 string and renders localised address input */
function LocaleFields({ region, disabled }: { region: Address['country']; disabled?: boolean }) {
	if (!isValidCountryCode(region)) throw new Error(`Invalid country code: ${region}`);

	const deferredRegion = useDeferredValue(region);
	const isStale = deferredRegion !== region;

	// Fetch region from cache or Google Address Metadata API
	const { data: metadata, isFetching } = useAddressMetadata(deferredRegion);
	const isLoading = isStale || isFetching;

	return <FieldLayout disabled={disabled} loading={isLoading} metadata={metadata} />;
}

function FieldLayout({
	metadata,
	loading = false,
	disabled,
}: {
	metadata: Partial<AddressMetadata>;
	loading?: boolean;
	disabled?: boolean;
}) {
	return (
		<span
			className='group/address-fields contents aria-busy:cursor-progress'
			aria-busy={loading || undefined}
			data-testid='address-locale'
		>
			<Fields disabled={loading || disabled} metadata={metadata} />
		</span>
	);
}

/** Render fields from field mapping */
function Fields({ ...props }: FieldProps) {
	// Not every region has a defined format (eg. Antarctica).
	// API route merges with generic 'ZZ' region, but this acts as a fallback.
	const rawFmt = props.metadata?.lfmt || props.metadata?.fmt || intlFmt;

	/** Keeps track of rendered fields to ensure components are included only once */
	const seen = new Set<string>();
	const fmt = rawFmt
		.split('%n')
		//
		// Split by field markers, discarding literals
		// Exclude name and org fields
		.map(v => v.match(/(%[A-Za-z])/g)?.filter(part => !['', '%N', '%O'].includes(part)) || [])
		//
		// Certain country fmt strings include a field twice (eg. Côte d'Ivoire and sorting codes)
		.map(arr =>
			arr.filter(v => {
				if (v[0] !== '%' || seen.has(v)) return false;
				seen.add(v);
				return true;
			}),
		)
		.filter(arr => arr.length > 0);

	return (
		<>
			{fmt?.map((arr, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: Index corresponds to address line number
					key={i}
					className={cn(
						'group/address-line flex border-b border-dotted empty:hidden focus-within:z-10 md:text-sm',

						'transition-colors duration-300 ease-out-quad',
						'group-aria-busy/address-fields:animate-pulse group-aria-busy/address-fields:delay-75 group-aria-busy/address-fields:**:delay-75',
						'group-aria-busy/address-fields:bg-muted group-aria-busy/address-fields:*:pointer-events-none',
					)}
				>
					{arr.map(v => {
						// Discard literals
						if (v[0] !== '%') return null;

						const Component = FIELD_MAPPING[v.substring(1)];
						return <Component key={v} {...props} />;
					})}
				</div>
			))}
		</>
	);
}
