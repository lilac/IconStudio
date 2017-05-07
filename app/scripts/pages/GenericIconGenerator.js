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

const ICON_SIZE = {w: 24, h: 24};
const TARGET_RECT = {x: 1, y: 1, w: 22, h: 22};

export class GenericIconGenerator extends BaseGenerator {
  setupForm() {
    super.setupForm();

    let defaultNameForSourceValue_ = v => {
      let name = studio.Util.sanitizeResourceName(v.name || 'example');
      return `ic_${name}`;
    };

    let nameField;
    this.form = new studio.Form({
      id: 'iconform',
      container: '#inputs-form',
      fields: [
        new studio.ImageField('source', {
          title: '源',
          helpText: '必须透明',
          maxFinalSize: { w: 720, h: 720 }, // max render size, for SVGs
          defaultValueClipart: 'ac_unit',
          dropTarget: document.body,
          onChange: (newValue, oldValue) => {
            if (nameField.getValue() == defaultNameForSourceValue_(oldValue)) {
              nameField.setValue(defaultNameForSourceValue_(newValue));
            }
          }
        }),
        new studio.RangeField('size', {
          newGroup: true,
          title: '尺寸',
          helpText: '最终生成图标的尺寸',
          min: 4,
          max: 200,
          defaultValue: 32,
          textFn: d => `${d}dp`,
        }),
        new studio.RangeField('padding', {
          title: '衬垫',
          helpText: '图标周围的衬垫',
          defaultValue: 8,
          textFn: d => `${d}dp`,
        }),
        new studio.ColorField('color', {
          title: '颜色',
          helpText: '要保留原始颜色请设置为透明',
          defaultValue: 'rgba(0, 0, 0, 0.54)',
          alpha: true
        }),
        (nameField = new studio.TextField('name', {
          title: '名称',
          helpText: '生成zip文件时使用为资源名',
          defaultValue: defaultNameForSourceValue_({})
        }))
      ]
    });
    this.form.onChange(field => this.regenerateDebounced_());
  }

  regenerate() {
    let values = this.form.getValues();

    this.zipper.clear();
    this.zipper.setZipFilename(`${values.name}.zip`);

    this.densities.forEach(density => {
      let mult = studio.Util.getMultBaseMdpi(density);
      let totalSize = values.size;
      let padding = Math.min(values.size / 2 - 1, values.padding);
      let iconSize = studio.Util.multRound(
          {w: totalSize, h: totalSize}, mult);
      let targetRect = studio.Util.multRound(
          {x: padding, y: padding, w: totalSize - padding * 2, h: totalSize - padding * 2}, mult);

      let outCtx = imagelib.Drawing.context(iconSize);
      let tmpCtx = imagelib.Drawing.context(iconSize);

      if (values.source.ctx) {
        let srcCtx = values.source.ctx;
        imagelib.Drawing.drawCenterInside(
            tmpCtx,
            srcCtx,
            targetRect,
            {x: 0, y: 0, w: srcCtx.canvas.width, h: srcCtx.canvas.height});
      }

      let color = values.color;
      let alpha = color.getAlpha();
      if (alpha > 0) {
        color.setAlpha(1);

        imagelib.Effects.fx([
          {effect: 'fill-color', color: color.toRgbString(), opacity: alpha}
        ], outCtx, tmpCtx, iconSize);

        color.setAlpha(alpha);
      } else {
        outCtx.drawImage(tmpCtx.canvas, 0, 0);
      }

      this.zipper.add({
        name: `res/drawable-${density}/${values.name}.png`,
        canvas: outCtx.canvas
      });

      this.setImageForSlot_(density, outCtx.canvas.toDataURL());
    });
  }
}
