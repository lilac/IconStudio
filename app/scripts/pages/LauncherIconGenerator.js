/*
 * Copyright 2016 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {studio} from '../studio';
import {imagelib} from '../imagelib';
import {BaseGenerator} from './BaseGenerator';

const ICON_SIZE = { w: 48, h: 48 };

const TARGET_RECTS_BY_SHAPE = {
  none: { x:  3, y:  3, w:  42, h:  42 },
  circle: { x:  2, y:  2, w:  44, h:  44 },
  square: { x:  5, y:  5, w:  38, h:  38 },
  vrect: { x:  8, y:  2, w:  32, h:  44 },
  hrect: { x:  2, y:  8, w:  44, h:  32 },
};

const GRID_OVERLAY_SVG =
    `<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <g fill="none" fill-rule="evenodd">
            <rect vector-effect="non-scaling-stroke" x="8" y="2" width="32" height="44" rx="3"/>
            <rect vector-effect="non-scaling-stroke" x="5" y="5" width="38" height="38" rx="3"/>
            <rect vector-effect="non-scaling-stroke" x="2" y="8" width="44" height="32" rx="3"/>
            <circle vector-effect="non-scaling-stroke" cx="24" cy="24" r="10"/>
            <circle vector-effect="non-scaling-stroke" cx="24" cy="24" r="22"/>
            <path vector-effect="non-scaling-stroke" d="M0 48L48 0M0 0l48 48M24 48V0M17 0v48M31 0v48M48 24H0M0 31h48M0 17h48"/>
        </g>
    </svg>`;


const DEFAULT_EFFECT_OPTIONS = [
  { id: 'none', title: '无' },
  { id: 'elevate', title: '提升' },
  { id: 'shadow', title: '阴影' },
  { id: 'score', title: '刻痕' }
];


const NO_SHAPE_EFFECT_OPTIONS = [
  { id: 'none', title: '无' },
  { id: 'score', title: '刻痕' }
];


export class LauncherIconGenerator extends BaseGenerator {
  get densities() {
    return new Set(['xxxhdpi' /* must be first */, 'web', 'xxhdpi', 'xhdpi', 'hdpi', 'mdpi']);
  }

  get gridOverlaySvg() {
    return GRID_OVERLAY_SVG;
  }

  setupForm() {
    let backColorField, effectsField;
    this.form = new studio.Form({
      id: 'iconform',
      container: '#inputs-form',
      fields: [
        new studio.ImageField('foreground', {
          title: '前景',
          maxFinalSize: { w: 720, h: 720 }, // max render size, for SVGs
          defaultValueTrim: 1,
          defaultValuePadding: .25,
          defaultValueClipart: 'android',
          dropTarget: document.body
        }),
        new studio.ColorField('foreColor', {
          newGroup: true,
          title: '前景颜色',
          helpText: '要使用原始颜色请设置为透明',
          alpha: true,
          defaultValue: 'rgba(96, 125, 139, 0)'
        }),
        (backColorField = new studio.ColorField('backColor', {
          title: '背景颜色',
          defaultValue: '#448aff'
        })),
        new studio.BooleanField('crop', {
          title: '比例',
          defaultValue: false,
          offText: '居中',
          onText: '裁剪'
        }),
        new studio.EnumField('backgroundShape', {
          title: '形状',
          options: [
            { id: 'none', title: '无' },
            { id: 'square', title: '方形' },
            { id: 'circle', title: '圆形' },
            { id: 'vrect', title: '高矩形' },
            { id: 'hrect', title: '宽矩形' }
          ],
          defaultValue: 'square',
          onChange: newValue => {
            backColorField.setEnabled(newValue != 'none');
            let newEffectsOptions = newValue == 'none'
                ? NO_SHAPE_EFFECT_OPTIONS
                : DEFAULT_EFFECT_OPTIONS;
            if (!newEffectsOptions.find(e => e.id == effectsField.getValue())) {
              effectsField.setValue(newEffectsOptions[0].id);
            }
            effectsField.setOptions(newEffectsOptions);
          }
        }),
        (effectsField = new studio.EnumField('effects', {
          title: '效果',
          buttons: true,
          options: DEFAULT_EFFECT_OPTIONS,
          defaultValue: 'none'
        })),
        new studio.TextField('name', {
          title: '名称',
          defaultValue: 'ic_launcher'
        })
      ]
    });
    this.form.onChange(field => this.regenerateDebounced_());
  }

  regenerate() {
    let values = this.form.getValues();

    this.zipper.clear();
    this.zipper.setZipFilename(`${values.name}.zip`);

    let xxxhdpiCtx = null;

    this.densities.forEach(density => {
      let ctx;
      if (density == 'xxxhdpi' || density == 'web') {
        ctx = this.regenerateRawAtDensity_(density);
        if (density == 'xxxhdpi') {
          xxxhdpiCtx = ctx;
        }
      } else {
        // just scale down xxxhdpi
        let mult = studio.Util.getMultBaseMdpi(density);
        let iconSize = studio.Util.multRound(ICON_SIZE, mult);
        ctx = imagelib.Drawing.context(iconSize);
        imagelib.Drawing.drawImageScaled(
            ctx, xxxhdpiCtx,
            0, 0, 192, 192,
            0, 0, iconSize.w, iconSize.h);
      }

      this.zipper.add({
        name: (density == 'web')
            ? 'web_hi_res_512.png'
            : `res/mipmap-${density}/${values.name}.png`,
        canvas: ctx.canvas
      });

      this.setImageForSlot_(density, ctx.canvas.toDataURL());
    });
  }

  regenerateRawAtDensity_(density) {
    let values = this.form.getValues();
    let foreSrcCtx = values.foreground ? values.foreground.ctx : null;
    let mult = studio.Util.getMultBaseMdpi(density);
    if (density == 'web') {
      mult = 512 / 48;
    }

    let iconSize = studio.Util.multRound(ICON_SIZE, mult);
    let targetRect = TARGET_RECTS_BY_SHAPE[values.backgroundShape];

    let outCtx = imagelib.Drawing.context(iconSize);

    let roundRectPath_ = (ctx, {x, y, w, h}, r) => {
      ctx.beginPath();
      ctx.moveTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    };

    let backgroundLayer = {
      // background layer
      draw: ctx => {
        ctx.scale(mult, mult);
        values.backColor.setAlpha(1);
        ctx.fillStyle = values.backColor.toRgbString();

        let targetRect = TARGET_RECTS_BY_SHAPE[values.backgroundShape];
        switch (values.backgroundShape) {
          case 'square':
          case 'vrect':
          case 'hrect':
            roundRectPath_(ctx, targetRect, 3);
            ctx.fill();
            break;

          case 'circle':
            ctx.beginPath();
            ctx.arc(
                targetRect.x + targetRect.w / 2,
                targetRect.y + targetRect.h / 2,
                targetRect.w / 2,
                0, 2 * Math.PI, false);
            ctx.closePath();
            ctx.fill();
            break;
        }
      },
      mask: true
    };

    let foregroundLayer = {
      // foreground content layer
      draw: ctx => {
        if (!foreSrcCtx) {
          return;
        }

        let drawFn_ = imagelib.Drawing[values.crop ? 'drawCenterCrop' : 'drawCenterInside'];
        drawFn_(ctx, foreSrcCtx, studio.Util.mult(targetRect, mult),
            {x: 0, y: 0, w: foreSrcCtx.canvas.width, h: foreSrcCtx.canvas.height});
      },
      effects: [],
      mask: !!(values.backgroundShape == 'none')
    };

    if (values.backgroundShape != 'none' &&values.effects == 'shadow') {
      foregroundLayer.effects.push({effect: 'cast-shadow'});
    }

    if (values.foreColor.getAlpha()) {
      foregroundLayer.effects.push({
        effect: 'fill-color',
        color: values.foreColor.toRgbString()
      });
    }

    if (values.backgroundShape != 'none' &&
        (values.effects == 'elevate' || values.effects == 'shadow')) {
      foregroundLayer.effects = foregroundLayer.effects.concat([
        {
          effect: 'outer-shadow',
          color: 'rgba(0, 0, 0, 0.2)',
          translateY: .25 * mult
        },
        {
          effect: 'outer-shadow',
          color: 'rgba(0, 0, 0, 0.2)',
          blur: 1 * mult,
          translateY: 1 * mult
        }
      ]);
    }

    let scoreLayer = {
      draw: ctx => {
        ctx.fillStyle = 'rgba(0, 0, 0, .1)';
        ctx.fillRect(0, 0, iconSize.w, iconSize.h / 2);
      }
    };

    imagelib.Drawing.drawLayers(outCtx, iconSize, {
      children: [
        values.backgroundShape != 'none' ? backgroundLayer : null,
        foregroundLayer,
        values.effects == 'score' ? scoreLayer : null,
      ],
      effects: [
        {
          effect: 'inner-shadow',
          color: 'rgba(255, 255, 255, 0.2)',
          translateY: .25 * mult
        },
        {
          effect: 'inner-shadow',
          color: 'rgba(0, 0, 0, 0.2)',
          translateY: -.25 * mult
        },
        {
          effect: 'fill-radialgradient',
          centerX: 0,
          centerY: 0,
          radius: iconSize.w,
          colors: [
            { offset: 0, color: 'rgba(255,255,255,.1)' },
            { offset: 1.0, color: 'rgba(255,255,255,0)' }
          ]
        },
        {
          effect: 'outer-shadow',
          color: 'rgba(0, 0, 0, 0.3)',
          blur: .7 * mult,
          translateY: .7 * mult
        }
      ]
    });

    return outCtx;
  }
}
