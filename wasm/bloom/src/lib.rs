//! Door 5 · the infinite bloom, the Rust side.
//!
//! The same tree walk as `apps/web/lib/bloom/bloom.ts`, compiled to
//! WebAssembly. No wasm-bindgen: the module exports plain functions, and the
//! page reads the results straight out of the module's memory.
//!
//!   alloc_out(max)  → pointer to room for `max` flowers (5 × f32 each)
//!   walk(...)       → how many flowers it wrote there
//!
//! Each flower holds a child in every petal, `ratio` times smaller, `dist`
//! out along the petal and turned by `twist`. The walk visits flowers parents
//! first, skipping whole subtrees that are off screen or too small to see.

use std::f64::consts::PI;

const UP: f64 = -PI / 2.0;

#[derive(Clone, Copy)]
struct Frame {
    x: f64,
    y: f64,
    size: f64,
    rot: f64,
    level: f64,
}

/// Room for `max` flowers in the module's memory; the page keeps the pointer.
#[no_mangle]
pub extern "C" fn alloc_out(max: u32) -> *mut f32 {
    let buf = vec![0f32; max as usize * 5].into_boxed_slice();
    Box::leak(buf).as_mut_ptr()
}

/// How far a flower and everything nested in it can reach from its centre.
fn subtree_reach(ratio: f64, dist: f64) -> f64 {
    (dist / (1.0 - ratio)).max(1.0) * 1.02
}

/// Walk the tree from the start frame; write (x, y, size, rot, level) per flower.
///
/// # Safety
/// `out` must point to at least `max * 5` f32s, as returned by `alloc_out(max)`.
#[no_mangle]
#[allow(clippy::too_many_arguments)]
pub unsafe extern "C" fn walk(
    out: *mut f32,
    max: u32,
    petals: u32,
    ratio: f64,
    dist: f64,
    twist: f64,
    x: f64,
    y: f64,
    size: f64,
    rot: f64,
    level: f64,
    width: f64,
    height: f64,
    min_size: f64,
) -> u32 {
    let out = std::slice::from_raw_parts_mut(out, max as usize * 5);
    let reach = subtree_reach(ratio, dist);
    let step = 2.0 * PI / petals as f64;
    let mut stack: Vec<Frame> = Vec::with_capacity(256);
    stack.push(Frame { x, y, size, rot, level });
    let mut n: usize = 0;
    while let Some(f) = stack.pop() {
        if n >= max as usize {
            break;
        }
        let r = f.size * reach;
        if f.size < min_size || f.x + r < 0.0 || f.x - r > width || f.y + r < 0.0 || f.y - r > height {
            continue;
        }
        let o = n * 5;
        out[o] = f.x as f32;
        out[o + 1] = f.y as f32;
        out[o + 2] = f.size as f32;
        out[o + 3] = f.rot as f32;
        out[o + 4] = f.level as f32;
        n += 1;
        for i in (0..petals).rev() {
            let a = f.rot + UP + i as f64 * step;
            stack.push(Frame {
                x: f.x + a.cos() * f.size * dist,
                y: f.y + a.sin() * f.size * dist,
                size: f.size * ratio,
                rot: f.rot + i as f64 * step + twist,
                level: f.level + 1.0,
            });
        }
    }
    n as u32
}

// Tested from the JS side: apps/web/lib/bloom/bloom.test.ts loads the built
// bloom.wasm and checks it returns exactly the same flowers as the TypeScript walk.
