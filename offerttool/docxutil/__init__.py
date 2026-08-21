"""Low-Level-Werkzeuge auf der WordprocessingML-Ebene."""

from .xmlutil import (
    W,
    clone,
    delete,
    iter_block_items,
    make_sdt,
    paragraph_text,
    set_paragraph_style,
    set_paragraph_text,
)

__all__ = [
    "W",
    "clone",
    "delete",
    "iter_block_items",
    "make_sdt",
    "paragraph_text",
    "set_paragraph_style",
    "set_paragraph_text",
]
