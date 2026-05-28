export type ErrorDetails = {
	heading?: React.ReactNode;
	message: React.ReactNode;
};

// Taken from the error list in the documentation
const errorCodeDetails = {
	invalid_callback_request: {
		message:
			'There was a problem when trying to authenticate. Please contact us if this error persists.',
	},
	state_not_found: {
		message:
			'There was a problem when trying to authenticate. Please contact us if this error persists.',
	},
	account_already_linked_to_different_user: {
		heading: 'Account already linked to a different user',
		message:
			'This provider has already been linked to another user. If this is you, remove it from your account settings before relinking it to the intended account.',
	},
	"email_doesn't_match": {
		message:
			'The provider you are attempting to link does not match the email address on your account. Please ensure the same email address is used before proceeding.',
	},
	email_not_found: {
		message:
			'This login provider has not shared your email address with us. Please ensure you have granted permission.',
	},
	no_callback_url: {
		message: 'We were unable to direct you to the correct location. Please try again.',
	},
	no_code: {
		message:
			'We were not able to authorise the login. Please ensure you have consented to the required permissions.',
	},
	oauth_provider_not_found: {
		message: 'This provider is not supported. Please try logging in with a different method.',
	},
	unable_to_link_account: {
		heading: 'Unable to link account',
		message: 'We were unable to link this provider to your account. Please try again later.',
	},
	unable_to_get_user_info: {
		message:
			'We were unable to retrieve your account information from this provider. Please ensure you have consented to the required permissions, and try again later.',
	},
	state_mismatch: {
		message:
			'There was a problem when trying to authenticate. Please ensure your browser permits cookies.',
	},
	signup_disabled: {
		message:
			'Sign up is disabled for this login provider. Please try again with a different method.',
	},

	// Default error
	internal_server_error: {
		message:
			'There was a problem when trying to authenticate. Please contact us if this error persists.',
	},
} satisfies Record<string, ErrorDetails>;

// URL search parameter seems to be slugified error message, which doesn't match above. This object contains aliases.
export const errorDetails = {
	...(errorCodeDetails as {
		[K in keyof typeof errorCodeDetails]: ErrorDetails;
	}),

	account_not_linked: errorCodeDetails.unable_to_link_account,
} satisfies Record<string, ErrorDetails>;
