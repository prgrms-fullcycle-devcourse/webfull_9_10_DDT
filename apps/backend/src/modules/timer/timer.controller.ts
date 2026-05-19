import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TimerService } from './timer.service';
import { CreateTimerDto } from './dto/create-timer.dto';
import { UpdateTimerDto } from './dto/update-timer.dto';

@Controller('timer')
export class TimerController {
  constructor(private readonly timerService: TimerService) {}

  @Post()
  create(@Body() createTimerDto: CreateTimerDto) {
    return this.timerService.create(createTimerDto);
  }

  @Get()
  findAll() {
    return this.timerService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.timerService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTimerDto: UpdateTimerDto) {
    return this.timerService.update(+id, updateTimerDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.timerService.remove(+id);
  }
}
