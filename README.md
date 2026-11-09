# texlite-tikz

A library of editable TikZ and pgfplots figures, used as an optional add-on by
[TexLite](https://github.com/SWUFE-DB-Group/TexLite). Every figure is a complete
standalone document that also compiles on its own.

## Use it with TexLite

Clone this repository into a folder named `addon` beside your
`texlite.config.json`, then enable it in that file:

    cd <directory containing texlite.config.json>
    git clone https://github.com/ChenZhongPu/texlite-tikz.git addon/texlite-tikz

    "tikzGallery": { "enabled": true }

`path` is optional and defaults to `addon/texlite-tikz`, relative to the
configuration file. Run `git pull` to update; no build or restart is needed.

## Use it with Coding Agents

TexLite tells Coding Agents where `TIKZ.md` is when the add-on is enabled. The
guide explains how to find a figure in the catalog, copy it into a project, edit
it and compile it, along with the color rules. The agents only read this repository.

## Layout

    TIKZ.md                      guide for Coding Agents working on figures
    library.json                 attribution shown in the gallery
    categories.json              icon categories and their labels
    catalog.json                 generated from the figures; do not edit
    figures/templates/<id>/
    figures/examples/<id>/
    figures/plots/<id>/          pgfplots charts with their data at the top of the file
    figures/icons/<category>/<id>/
        figure.tex               a complete standalone document
        meta.json                name, type, tags, license, ...
        preview.svg              generated from figure.tex

## Adding a figure

1. Create the directory and write `figure.tex` and `meta.json`. The directory name
   must equal `id`; an icon also needs a `category` from `categories.json`.
2. Run `node build.mjs --previews`, then `node build.mjs --verify`.

Run `node build.mjs --previews <id>` after changing a figure, and commit the
updated `catalog.json` and `preview.svg`. A new category needs only an entry in
`categories.json`. The build needs Node.js 24 or newer, `latexmk` and `pdftocairo`.

`catalog.json` carries a format `version`. Raise it only for a change that TexLite
must be updated to read.

## License and origin

Each figure's `meta.json` states its license. The initial figures come from
[OpenTikZ](https://github.com/opentikz/opentikz) at commit
`359befbf8e8af7ce08e7e387b2c2a198e0ca735d`, dedicated to the public domain under
CC0 1.0 (`LICENSE-CONTENT`). `TIKZ.md` is adapted from that project's `using-opentikz`
skill (MIT for code, CC0 1.0 for content). This library is maintained independently and does not
track that project. CC0 grants no trademark rights: brand marks remain the
property of their owners.
