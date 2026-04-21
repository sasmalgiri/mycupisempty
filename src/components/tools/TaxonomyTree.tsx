'use client';

/**
 * TaxonomyTree — expandable tree of biological classification.
 * Full 5-kingdom + 3-domain compatible layout.
 */

import { useState } from 'react';

interface Node { name: string; description?: string; children?: Node[]; examples?: string[]; }

const TAXONOMY: Node = {
  name: 'Living Things',
  description: 'All organisms on Earth.',
  children: [
    {
      name: 'Kingdom: Animalia',
      description: 'Multicellular, heterotrophic, motile (usually).',
      children: [
        {
          name: 'Phylum: Chordata',
          description: 'Has a notochord at some stage.',
          children: [
            { name: 'Class: Mammalia', description: 'Warm-blooded, fur/hair, mammary glands.', examples: ['Human', 'Tiger', 'Whale', 'Bat'] },
            { name: 'Class: Aves', description: 'Feathers, lay eggs, most fly.', examples: ['Eagle', 'Peacock', 'Penguin'] },
            { name: 'Class: Reptilia', description: 'Cold-blooded, scales, lay eggs.', examples: ['Snake', 'Turtle', 'Crocodile'] },
            { name: 'Class: Amphibia', description: 'Live part in water, part on land.', examples: ['Frog', 'Salamander'] },
            { name: 'Class: Pisces (Fish)', description: 'Gills, fins, scales, cold-blooded.', examples: ['Rohu', 'Shark', 'Goldfish'] },
          ],
        },
        {
          name: 'Phylum: Arthropoda',
          description: 'Jointed legs, exoskeleton.',
          children: [
            { name: 'Class: Insecta', examples: ['Ant', 'Butterfly', 'Beetle'] },
            { name: 'Class: Arachnida', examples: ['Spider', 'Scorpion'] },
            { name: 'Class: Crustacea', examples: ['Crab', 'Prawn', 'Lobster'] },
          ],
        },
        { name: 'Phylum: Mollusca', examples: ['Snail', 'Octopus', 'Clam'] },
        { name: 'Phylum: Porifera (Sponges)', examples: ['Sea sponge'] },
      ],
    },
    {
      name: 'Kingdom: Plantae',
      description: 'Multicellular, autotrophic, cell walls with cellulose.',
      children: [
        { name: 'Bryophytes (mosses)', examples: ['Moss', 'Liverwort'] },
        { name: 'Pteridophytes (ferns)', examples: ['Fern', 'Horsetail'] },
        { name: 'Gymnosperms', description: 'Naked seeds.', examples: ['Pine', 'Cedar'] },
        {
          name: 'Angiosperms (flowering plants)',
          description: 'Seeds enclosed in fruit.',
          children: [
            { name: 'Monocots', examples: ['Rice', 'Wheat', 'Banana'] },
            { name: 'Dicots', examples: ['Rose', 'Mango', 'Neem'] },
          ],
        },
      ],
    },
    {
      name: 'Kingdom: Fungi',
      description: 'Heterotrophic, cell walls with chitin.',
      examples: ['Mushroom', 'Yeast', 'Mold', 'Bread fungus'],
    },
    {
      name: 'Kingdom: Protista',
      description: 'Mostly unicellular, eukaryotic.',
      examples: ['Amoeba', 'Paramecium', 'Algae', 'Euglena'],
    },
    {
      name: 'Kingdom: Monera (Bacteria)',
      description: 'Prokaryotic, unicellular, no nucleus.',
      examples: ['E. coli', 'Lactobacillus', 'Cyanobacteria'],
    },
  ],
};

function TreeNode({ node, level = 0 }: { node: Node; level?: number }) {
  const [open, setOpen] = useState(level === 0);
  const hasChildren = (node.children && node.children.length > 0) || (node.examples && node.examples.length > 0);

  return (
    <li className="my-1">
      <div
        className={`inline-flex items-start gap-1 ${hasChildren ? 'cursor-pointer select-none' : ''}`}
        onClick={() => hasChildren && setOpen(!open)}
        role={hasChildren ? 'button' : undefined}
        tabIndex={hasChildren ? 0 : undefined}
      >
        {hasChildren && (
          <span className="w-4 text-xs text-gray-500">{open ? '▼' : '▶'}</span>
        )}
        {!hasChildren && <span className="w-4" />}
        <div>
          <span className={`font-medium text-sm ${level === 0 ? 'text-lg font-bold' : ''}`}>{node.name}</span>
          {node.description && <span className="text-xs text-gray-500 ml-2">— {node.description}</span>}
        </div>
      </div>
      {open && node.children && (
        <ul className="ml-6 border-l border-gray-200 dark:border-gray-800 pl-3">
          {node.children.map((c, i) => <TreeNode key={i} node={c} level={level + 1} />)}
        </ul>
      )}
      {open && node.examples && (
        <ul className="ml-6 mt-1 flex flex-wrap gap-1">
          {node.examples.map((e, i) => (
            <li key={i} className="text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full">{e}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function TaxonomyTree() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
      <h3 className="font-bold mb-3">🌳 Taxonomy Tree</h3>
      <ul className="text-sm">
        <TreeNode node={TAXONOMY} />
      </ul>
    </div>
  );
}
