// The base library performs address validation, which is incompatible with the slightly looser validation rules we use.
// This is a slightly modified fork of the lib-address util, without validation

import { type AnyAddress, type BaseAddress, type formatAddress, getCountryData } from 'lib-address';

import { type Simplify } from '..';

export function formatAddressLib(
	address: Parameters<typeof formatAddress>[0],
	opts?: Parameters<typeof formatAddress>[1],
): string {
	const {
		preserveCase = false,
		useStateISOCode = false,
		appendCountry = false,
		useCountryISOCode = false,
		useLatin = false,
		lang,
	} = opts ?? {};

	const cpy = { ...address };
	const data = getCountryData(cpy.country);

	const stateData = cpy.state ? data.sub_regions?.find(sr => sr.key === cpy.state) : null;

	const fmt = useLatin ? (data.lfmt ?? data.fmt) : data.fmt;
	const upper = data.upper;

	if (!useStateISOCode && stateData) {
		cpy.state = [
			lang && stateData.name[lang],
			useLatin && stateData.name.latin,
			stateData.name.default,
		].filter(Boolean)[0] as string;
	}

	const {
		addressLine1 = '',
		addressLine2 = '',
		addressLine3 = '',
		city = '',
		dependentLocality = '',
		name = '',
		organization = '',
		sortingCode = '',
		state = '',
		zip = '',
	} = preserveCase ? cpy : convertAddressCasing(cpy, upper);

	const addressLine = [addressLine1, addressLine2, addressLine3].filter(Boolean).join('\n');

	const nationalFormat = fmt
		.replace(/%N/g, name)
		.replace(/%O/g, organization)
		.replace(/%A/g, addressLine)
		.replace(/%D/g, dependentLocality)
		.replace(/%C/g, city)
		.replace(/%S/g, state)
		.replace(/%Z/g, zip)
		.replace(/%X/g, sortingCode)
		.replace(/(%n)+/g, '\n')
		.trim();

	if (appendCountry) {
		return useCountryISOCode ? `${nationalFormat}\n${data.key}` : `${nationalFormat}\n${data.name}`;
	}

	return nationalFormat;
}

function convertAbbrStringToObject(value: string) {
	return {
		name: value.includes('N'),
		organization: value.includes('O'),
		addressLine1: value.includes('A'),
		dependentLocality: value.includes('D'),
		city: value.includes('C'),
		state: value.includes('S'),
		zip: value.includes('Z'),
		sortingCode: value.includes('X'),
	};
}

function convertAddressCasing(address: Simplify<AnyAddress & BaseAddress>, upper: string) {
	const upperFields = convertAbbrStringToObject(upper);

	return {
		country: address.country,
		name: upperFields.name ? address.name?.toUpperCase() : address.name,
		organization: upperFields.organization
			? address.organization?.toUpperCase()
			: address.organization,
		addressLine1: upperFields.addressLine1
			? address.addressLine1?.toUpperCase()
			: address.addressLine1,
		addressLine2: upperFields.addressLine1
			? address.addressLine2?.toUpperCase()
			: address.addressLine2,
		addressLine3: upperFields.addressLine1
			? address.addressLine3?.toUpperCase()
			: address.addressLine3,
		dependentLocality: upperFields.dependentLocality
			? address.dependentLocality?.toUpperCase()
			: address.dependentLocality,
		city: upperFields.city ? address.city?.toUpperCase() : address.city,
		state: upperFields.state ? address.state?.toUpperCase() : address.state,
		zip: upperFields.zip ? address.zip?.toUpperCase() : address.zip,
		sortingCode: upperFields.sortingCode ? address.sortingCode?.toUpperCase() : address.sortingCode,
	};
}
