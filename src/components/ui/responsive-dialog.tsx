'use client';

import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer';
import { type ComponentProps, createContext, use } from 'react';

import { useMediaQuery } from '@/lib/hooks';

import * as DialogBase from './dialog';
import * as DrawerBase from './drawer';

const MediaProvider = createContext(false);

function Dialog(
	props: ComponentProps<typeof DialogBase.Dialog> & ComponentProps<typeof DrawerBase.Drawer>,
) {
	const media = useMediaQuery('only screen and (min-width : 40rem)', {
		initializeWithValue: false,
	});

	return (
		<MediaProvider value={media}>
			{media ? <DialogBase.Dialog {...props} /> : <DrawerBase.Drawer {...props} />}
		</MediaProvider>
	);
}

function DialogTrigger(
	props: ComponentProps<typeof DialogBase.DialogTrigger> &
		ComponentProps<typeof DrawerBase.DrawerTrigger>,
) {
	const media = use(MediaProvider);
	return media ? <DialogBase.DialogTrigger {...props} /> : <DrawerBase.DrawerTrigger {...props} />;
}

function DialogPortal(props: ComponentProps<typeof DialogBase.DialogPortal>) {
	const media = use(MediaProvider);
	return media ? <DialogBase.DialogPortal {...props} /> : <DrawerBase.DrawerPortal {...props} />;
}

function DialogClose(props: ComponentProps<typeof DialogBase.DialogClose>) {
	const media = use(MediaProvider);
	return media ? <DialogBase.DialogClose {...props} /> : <DrawerBase.DrawerClose {...props} />;
}

function DialogBackdrop(props: ComponentProps<typeof DialogBase.DialogBackdrop>) {
	const media = use(MediaProvider);
	return media ? <DialogBase.DialogBackdrop {...props} /> : <DrawerBase.DrawerOverlay {...props} />;
}

function DialogContent(
	props: ComponentProps<typeof DialogBase.DialogContent> &
		ComponentProps<typeof DrawerBase.DrawerContent>,
) {
	const media = use(MediaProvider);
	return media ? <DialogBase.DialogContent {...props} /> : <DrawerBase.DrawerContent {...props} />;
}

function DialogHeader(props: ComponentProps<typeof DialogBase.DialogHeader>) {
	const media = use(MediaProvider);
	return media ? <DialogBase.DialogHeader {...props} /> : <DrawerBase.DrawerHeader {...props} />;
}

function DialogFooter(props: ComponentProps<typeof DialogBase.DialogFooter>) {
	const media = use(MediaProvider);
	return media ? <DialogBase.DialogFooter {...props} /> : <DrawerBase.DrawerFooter {...props} />;
}

function DialogTitle(props: ComponentProps<typeof DialogBase.DialogTitle>) {
	const media = use(MediaProvider);
	return media ? <DialogBase.DialogTitle {...props} /> : <DrawerBase.DrawerTitle {...props} />;
}

function DialogDescription(props: ComponentProps<typeof DialogBase.DialogDescription>) {
	const media = use(MediaProvider);
	return media ? (
		<DialogBase.DialogDescription {...props} />
	) : (
		<DrawerBase.DrawerDescription {...props} />
	);
}

// `DrawerBase.Drawer` is a subtype of `DialogBase.Dialog`:
// handles created here work regardless of which variant renders at a given breakpoint.
const createDialogHandle = DrawerPrimitive.createHandle;

export {
	createDialogHandle,
	Dialog,
	DialogBackdrop,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
};
