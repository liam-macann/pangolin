import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright';
import { Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';

/** Repeats each noise source at the same interval as the scribble, keeping tile edges seamless. */
function PencilFilter({ tileSize }: { tileSize: number }) {
	function tiledNoise(name: string, frequency: number, seed = 0) {
		return (
			<>
				<feTurbulence
					type='fractalNoise'
					baseFrequency={frequency}
					numOctaves={5}
					seed={seed}
					stitchTiles='stitch'
					width={tileSize}
					height={tileSize}
				/>
				<feTile result={name} />
			</>
		);
	}

	return (
		<filter id='pencil' filterUnits='userSpaceOnUse' x={0} y={0} width='100%' height='100%'>
			{tiledNoise('grain', 2)}

			<feColorMatrix
				in='grain'
				values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.5 1.5'
				result='grainMask'
			/>
			<feComposite in='SourceGraphic' in2='grainMask' operator='in' result='textured' />

			{[0, 1, 2].map(seed => (
				<Fragment key={seed}>
					{tiledNoise('wobble', 0.03, seed)}
					<feDisplacementMap
						in='textured'
						in2='wobble'
						scale={5}
						xChannelSelector='R'
						yChannelSelector='G'
						result={`stroke${seed}`}
					/>
				</Fragment>
			))}

			<feBlend in='stroke1' in2='stroke0' mode='multiply' result='strokes' />
			<feBlend in='strokes' in2='stroke2' mode='multiply' />
		</filter>
	);
}

/** Bakes an SVG from `src/assets` into a mask PNG in `public`. Dimensions are in CSS pixels. */
async function bake(
	page: Page,
	name: string,
	options: { width: number; padding?: number; repeat?: boolean },
) {
	const { width, padding = 0, repeat = false } = options;
	const source = fs.readFileSync(path.resolve('src/assets', `${name}.svg`));
	const svg = source.toString('base64');
	const size = await sharp(source).metadata();
	const height = Math.ceil(((width - padding * 2) * size.height) / size.width + padding * 2);

	// Repeating masks need neighbours on both sides for displacement; export only the middle copy
	const offsets = repeat ? [0, width, width * 2] : [0];

	await page.setContent(
		renderToStaticMarkup(
			<body style={{ margin: 0 }}>
				<svg
					role='presentation'
					width={width * offsets.length}
					height={height}
					style={{ display: 'block' }}
				>
					<defs>
						<PencilFilter tileSize={width} />
					</defs>
					<g filter='url(#pencil)'>
						{offsets.map(x => (
							<image
								key={x}
								href={`data:image/svg+xml;base64,${svg}`}
								x={x + padding}
								y={padding}
								width={width - padding * 2}
								height={height - padding * 2}
							/>
						))}
					</g>
				</svg>
			</body>,
		),
	);

	const image = await page.screenshot({
		clip: { x: repeat ? width : 0, y: 0, width, height },
		omitBackground: true,
	});

	await sharp(image)
		.toColourspace('b-w')
		.png({ palette: true, colors: 4, effort: 10, dither: 1, compressionLevel: 9 })
		.toFile(path.resolve('public', `${name}.png`));
}

await using browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 8 });

// Match the 6rem repeat width used by the void amount mask
await bake(page, 'scribble', { width: 96, repeat: true });
// Leave room around the circle for displaced strokes
await bake(page, 'scribble-circle', { width: 56, padding: 4 });
