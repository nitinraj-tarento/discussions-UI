import { CONTEXT_PROPS } from './../../services/discussion.service';
import { Component, EventEmitter, Input, OnInit, Output, TemplateRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { DiscussionService } from '../../services/discussion.service';
import { ConfigService } from '../../services/config.service';
import { TelemetryUtilsService } from './../../telemetry-utils.service';
import * as CONSTANTS from './../../common/constants.json';
/* tslint:disable */
import * as _ from 'lodash'
import { NSDiscussData } from '../../models/discuss.model';
import { DiscussStartComponent } from '../discuss-start/discuss-start.component';
import { Subscription } from 'rxjs';
import { NavigationServiceService } from '../../navigation-service.service';
// import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';

/* tslint:enable */

@Component({
  selector: 'lib-discuss-all',
  templateUrl: './discuss-all.component.html',
  styleUrls: ['./discuss-all.component.scss']
})
export class DiscussAllComponent implements OnInit {

  @Input() context: any
  @Input() categoryAction;

  @Output() stateChange: EventEmitter<any> = new EventEmitter();

  discussionList: any[];
  routeParams: any;
  showStartDiscussionModal = false;
  categoryId: string;
  isTopicCreator = false;
  showLoader = false;
  currentFilter = 'recent'
  currentActivePage: number = 1;
  fetchNewData: false;
  // modalRef: BsModalRef;
  paramsSubscription: Subscription;
  getParams: any;
  cIds: any = [];
  allTopics: any;
  trendingTags!: NSDiscussData.ITag[];
  sticky = false;
  data
  startDiscussionCategoryId: any;
  isWidget: boolean;

  constructor(
    public router: Router,
    private route: ActivatedRoute,
    private discussionService: DiscussionService,
    private configService: ConfigService,
    public activatedRoute: ActivatedRoute,
    private telemetryUtils: TelemetryUtilsService,
    private navigationService: NavigationServiceService
    // private modalService: BsModalService
  ) { }

  ngOnInit() {
    this.telemetryUtils.logImpression(NSDiscussData.IPageName.HOME);
    if (this.context) {
      this.isWidget  = true
      this.getForumIds()
    } else {
      this.cIds = this.configService.getCategories().result
      this.loadDiscussionData()
    }
  }

  async getForumIds() {
    let body = {
      "identifier":
        this.context.contextIdArr
      ,
      "type": this.context.contextType
    }
    let resp = await this.discussionService.getForumIds(body)
    if (resp.result.length > 0) {
      resp.result.forEach(forum => {
        this.cIds.push(forum.cid)
      });
    } else {
      this.discussionService.createForum(this.context.categoryObj).subscribe(((data: any) => {
        data.result.forEach(forum => {
          this.cIds.push(forum.newCid)
        });
      }))

    }
    this.loadDiscussionData()
  }

  loadDiscussionData() {
    // debugger
    // this.cIds = this.context ? this.context.categories : this.configService.getCategories()
    this.categoryId = this.discussionService.getContext(CONTEXT_PROPS.cid);
    if (this.configService.hasContext() || this.context) {
      this.getContextBasedDiscussion(this.cIds)
      // This is to show context based trending tags
      this.getContextBasedTags(this.cIds);
    } else {
      // this.currentActivePage = 1
      this.refreshData();
      // This is to show trending tags
      this.fetchAllTags();
    }
  }

  navigateToDiscussionDetails(discussionData) {

    const matchedTopic = _.find(this.telemetryUtils.getContext(), { type: 'Topic' });
    if (matchedTopic) {
      this.telemetryUtils.deleteContext(matchedTopic);
    }

    this.telemetryUtils.uppendContext({
      id: _.get(discussionData, 'tid'),
      type: 'Topic'
    });

    const slug = _.trim(_.get(discussionData, 'slug'));
    // tslint:disable-next-line: max-line-length
    const input = { data: { url: `${this.configService.getRouterSlug()}${CONSTANTS.ROUTES.TOPIC}${slug}`, queryParams: {} }, action: CONSTANTS.CATEGORY_DETAILS, }
    this.navigationService.navigate(input);
    this.stateChange.emit({ action: CONSTANTS.CATEGORY_DETAILS, title: discussionData.title, tid: discussionData.tid });

    // this.router.navigate([`${this.configService.getRouterSlug()}${CONSTANTS.ROUTES.TOPIC}${slug}`], { queryParamsHandling: "merge" });
  }

  acceptData(singleTagDetails) {
    // debugger
    if(this.context){
    singleTagDetails.cIds =  this.cIds;
    }
    this.stateChange.emit(singleTagDetails);
  }

  getDiscussionList(slug: string) {
    this.showLoader = true;
    // TODO : this.currentActivePage shoulb be dynamic when pagination will be implemented
    this.discussionService.getContextBasedTopic(slug, this.currentActivePage).subscribe(data => {
      this.showLoader = false;
      this.isTopicCreator = _.get(data, 'privileges.topics:create') === true ? true : false;
      this.discussionList = _.union(_.get(data, 'topics'), _.get(data, 'children'));
    }, error => {
      this.showLoader = false;
      // TODO: Toaster
      console.log('error fetching topic list', error);
    });
  }

  filter(key: string | 'recent' | 'popular') {
    if (key) {
      this.currentFilter = key;
      switch (key) {
        case 'recent':
          this.cIds.length ? this.getContextData(this.cIds.result) : this.fillrecent()
          break;
        case 'popular':
          this.cIds.length ? this.getContextData(this.cIds.result) : this.fillPopular()
          break;
        default:
          break;
      }
    }
  }

  fillrecent(_page?: any) {
    this.getRecentData(_page)
  }

  fillPopular(page?: any) {
    this.showLoader = true;
    return this.discussionService.fetchPopularD(page).subscribe((response: any) => {
      this.showLoader = false;
      this.discussionList = [];
      _.filter(response.topics, (topic) => {
        if (topic.user.uid !== 0 && topic.cid !== 1 ) {
          this.discussionList.push(topic);
        }
      });
      // this.discussionList = _.get(response, 'topics')
    }, error => {
      this.showLoader = false;
      // TODO: Toaster
      console.log('error fetching topic list', error);
    });
  }

  getContextBasedDiscussion(cid: any) {
    this.currentFilter === 'recent' ? this.getContextData(cid) : this.getContextData(cid)
  }

  refreshData(page?: any) {
    this.currentFilter === 'recent' ? this.getRecentData(page) : this.fillPopular(page)
  }

  getRecentData(page: any) {
    this.showLoader = true;
    return this.discussionService.fetchRecentD(page).subscribe(
      (data: any) => {
        this.showLoader = false;
        this.discussionList = [];
        _.filter(data.topics, (topic) => {
          if (topic.user.uid !== 0 && topic.cid !== 1) {
            this.discussionList.push(topic);
          }
        });
      }, error => {
        this.showLoader = false;
        // TODO: Toaster
        console.log('error fetching topic list', error);
      });
  }

  getContextData(cid: any) {
    this.showLoader = true;
    const req = {
      // request: {
      cids: cid
      // }
    };
    return this.discussionService.getContextBasedDiscussion(req).subscribe(
      (data: any) => {
        this.showLoader = false;
        let result = data.result
        let res = result.filter((elem) => {
          return (elem.statusCode !== 404)
        })
        this.allTopics = _.map(res, (topic) => topic.topics);
        this.discussionList = _.flatten(this.allTopics)
      }, error => {
        this.showLoader = false;
        // TODO: Toaster
        console.log('error fetching topic list', error);
      });
  }

  fetchAllTags() {
    this.showLoader = true;
    this.discussionService.fetchAllTag().subscribe(data => {
      this.showLoader = false;
      this.trendingTags = _.get(data, 'tags');
    }, error => {
      this.showLoader = false;
      // TODO: toaster
      console.log('error fetching tags');
    });
  }

  getContextBasedTags(cid: any) {
    const req = {
      cids: cid
    }
    this.showLoader = true;
    this.discussionService.contextBasedTags(req).subscribe(data => {
      this.showLoader = false;
      this.trendingTags = _.get(data, 'result');
    }, error => {
      this.showLoader = false;
      // TODO: toaster
      console.log('error fetching tags');
    });
  }

  // startDiscussion(template: TemplateRef<any>) {
  //   this.modalRef = this.modalService.show(template);

  // this.showStartDiscussionModal = true;
  // this.bsModalRef = this.modalService.show(DiscussStartComponent);

  // this.bsModalRef.content.onClose().subscribe(
  //   console.log('completed')
  // );
  // }

  startDiscussion() {
    debugger
    this.showStartDiscussionModal = true;
    if (this.context) {
      this.startDiscussionCategoryId = this.cIds;
    }

  }

  logTelemetry(event) {
    this.telemetryUtils.logInteract(event, NSDiscussData.IPageName.HOME);
  }

  closeModal(event) {
    if (_.get(event, 'message') === 'success') {
      if (this.context) {
        this.getContextBasedDiscussion(this.cIds)
      } else {
        this.refreshData()
      }
      // this.getDiscussionList(_.get(this.routeParams, 'slug'));
    }
    this.showStartDiscussionModal = false;
  }
}
